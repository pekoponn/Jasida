// With npm run dev active:
// npx agent-browser open http://127.0.0.1:5173
// npx agent-browser eval --stdin < tests/image-upload.browser.js
(async () => {
  const { prepareUploadPhoto, validateUploadPhoto, PHOTO_MAX_BYTES } =
    await import('/src/lib/imageUpload.js');
  const { convertToWebp } = await import('/src/lib/imageUtils.js');
  const results = [];
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  const rejects = async (fn, message) => {
    let failed = false;
    try {
      await fn();
    } catch {
      failed = true;
    }
    assert(failed, message);
  };
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  async function fixture(type, width, height) {
    canvas.width = width;
    canvas.height = height;
    const pixels = context.createImageData(width, height);
    let seed = 42;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      pixels.data[i] = seed & 255;
      pixels.data[i + 1] = (seed >>> 8) & 255;
      pixels.data[i + 2] = (seed >>> 16) & 255;
      pixels.data[i + 3] = 255;
    }
    context.putImageData(pixels, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.95));
    return new File([blob], `road.${type.split('/')[1]}`, { type });
  }

  let png;
  let validWebp;
  for (const [type, width, height] of [
    ['image/png', 2400, 1800],
    ['image/jpeg', 2400, 1800],
    ['image/webp', 100, 80],
    ['image/png', 32, 4096],
  ]) {
    const input = await fixture(type, width, height);
    if (!png) png = input;
    const output = await prepareUploadPhoto(input);
    assert(output.size > 0 && output.size <= PHOTO_MAX_BYTES, 'Oversized output');
    assert(output.type === 'image/webp' && output.name.endsWith('.webp'), 'Wrong type/name');
    await validateUploadPhoto(output);
    const decoded = await createImageBitmap(output);
    assert(
      Math.abs(decoded.width / decoded.height - width / height) < 0.03,
      'Aspect ratio changed'
    );
    assert(Math.max(decoded.width, decoded.height) <= 1600, 'Dimensions too large');
    assert((await prepareUploadPhoto(output)) === output, 'Prepared file was encoded twice');
    results.push({
      input: type,
      inputBytes: input.size,
      outputBytes: output.size,
      width: decoded.width,
      height: decoded.height,
    });
    decoded.close();
    validWebp = output;
  }

  await rejects(
    () => prepareUploadPhoto(new File([], 'empty.png', { type: 'image/png' })),
    'Empty accepted'
  );
  await rejects(
    () => prepareUploadPhoto(new File(['broken'], 'bad.png', { type: 'image/png' })),
    'Corrupt accepted'
  );
  await rejects(
    () => prepareUploadPhoto(new File(['<svg/>'], 'bad.svg', { type: 'image/svg+xml' })),
    'SVG accepted'
  );
  await rejects(
    () =>
      prepareUploadPhoto(
        new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'huge.png', { type: 'image/png' })
      ),
    'Huge input accepted'
  );
  const mislabelled = new File([png], 'fake.webp', { type: 'image/webp' });
  const reencoded = await prepareUploadPhoto(mislabelled);
  assert(reencoded !== mislabelled, 'Mislabelled input was passed through');
  await validateUploadPhoto(reencoded);
  await rejects(
    () => validateUploadPhoto(new File(['fake'], 'bad.webp', { type: 'image/webp' })),
    'Invalid WebP header accepted'
  );
  await rejects(
    () =>
      validateUploadPhoto(
        new File([validWebp, new Uint8Array(100000 - validWebp.size)], 'boundary.webp', {
          type: 'image/webp',
        })
      ),
    '100 KB boundary accepted'
  );

  const originalToBlob = HTMLCanvasElement.prototype.toBlob;
  try {
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(new Blob(['fallback'], { type: 'image/png' }));
    };
    await rejects(() => prepareUploadPhoto(png), 'Unsupported WebP silently fell back to PNG');
    HTMLCanvasElement.prototype.toBlob = function (callback) {
      callback(null);
    };
    await rejects(() => prepareUploadPhoto(png), 'Null encoder output accepted');
  } finally {
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  }

  // Exercise both upload entrypoints with a stub transport: no production writes.
  const { supabase } = await import('/src/lib/supabaseClient.js');
  const { uploadReportImage, addReportPhoto, completeReportWithActuals } =
    await import('/src/lib/reports.js');
  const originalStorage = supabase.storage.from;
  const originalFrom = supabase.from;
  const originalGetUser = supabase.auth.getUser;
  const uploaded = [];
  const updates = [];
  try {
    supabase.storage.from = () => ({
      upload: async (path, file, options) => {
        await validateUploadPhoto(file);
        assert(path.endsWith('.webp'), 'Non-WebP path sent');
        assert(options.contentType === 'image/webp', 'Wrong upload MIME');
        uploaded.push({ path, size: file.size });
        return { error: null };
      },
    });
    supabase.from = () => ({
      update: (patch) => {
        updates.push(patch);
        return {
          eq: () => ({
            error: null,
            select: () => ({ single: async () => ({ data: patch, error: null }) }),
          }),
        };
      },
      insert: async () => ({ error: null }),
    });
    supabase.auth.getUser = async () => ({ data: { user: { id: 'test-user' } } });
    await uploadReportImage(png, 'test-report');
    await rejects(() => addReportPhoto('test-report', null), 'Missing photo accepted');
    await addReportPhoto('test-report', png, 'resolution');
    await rejects(
      () => uploadReportImage(new File(['bad'], 'bad.png', { type: 'image/png' }), 'test-report'),
      'Bad file reached upload'
    );
    const converted = await convertToWebp(png);
    await validateUploadPhoto(converted);
    assert(
      (await convertToWebp(converted)) === converted,
      'Compatibility helper recompressed a prepared photo'
    );
    const materials = [{ name: 'Test material', quantity: 2 }];
    await completeReportWithActuals('test-report', {
      file: png,
      actualMaterials: 'Test',
      actualMaterialsJson: materials,
      actualCost: 10,
    });
    assert(
      updates.at(-1).status === 'resolved' && updates.at(-1).actual_materials_json === materials,
      'Completion lost status/material details'
    );
    const updateCount = updates.length;
    await rejects(
      () =>
        completeReportWithActuals('test-report', {
          file: new File(['bad'], 'bad.png', { type: 'image/png' }),
        }),
      'Invalid resolution photo accepted'
    );
    assert(updates.length === updateCount, 'Invalid photo changed report status');
    supabase.storage.from = () => ({
      upload: async () => ({ error: new Error('Simulated storage failure') }),
    });
    await rejects(
      () => completeReportWithActuals('test-report', { file: converted }),
      'Failed upload marked report complete'
    );
    assert(updates.length === updateCount, 'Upload failure changed report status');
    assert(uploaded.length === 3, 'Unexpected number of storage writes');
  } finally {
    supabase.storage.from = originalStorage;
    supabase.from = originalFrom;
    supabase.auth.getUser = originalGetUser;
  }
  return { passed: true, conversions: results, uploadCalls: uploaded.length };
})();
