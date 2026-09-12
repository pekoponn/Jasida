// Run in the dev browser with agent-browser eval --stdin < this file.
// Reads up to three existing report images; never writes to Supabase.
(async () => {
  const { detectDamage } = await import('/src/ai/yolo.js');
  const { embedImage } = await import('/src/ai/clip.js');
  const { prepareUploadPhoto } = await import('/src/lib/imageUpload.js');
  const { computeHazardScore } = await import('/src/ai/hazardScore.js');
  const { listReportsFeed } = await import('/src/lib/reports.js');
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const results = [];
  const reports = await listReportsFeed();
  for (const report of reports.filter(r => r.imageUrl).slice(0, 3)) {
    const response = await fetch(report.imageUrl);
    assert(response.ok, 'Report image unavailable');
    const blob = await response.blob();
    const file = new File([blob], `road.${blob.type.split('/')[1]}`, { type: blob.type });
    const webp = await prepareUploadPhoto(file);
    const original = await detectDamage(file);
    const converted = await detectDamage(webp);
    const hazard = computeHazardScore(converted);
    assert(Number.isFinite(hazard.total) && hazard.total >= 0 && hazard.total <= 100, 'Invalid score');
    assert(['aman', 'sedang', 'darurat'].includes(hazard.severity), 'Invalid severity');
    assert(converted.detections.every(d => Number.isFinite(d.confidence) && d.confidence >= 0 && d.confidence <= 1), 'Invalid confidence');
    let duplicate;
    try {
      const embedding = await embedImage(webp);
      assert(embedding.length === 512, 'Wrong embedding length');
      duplicate = 'real-model';
    } catch {
      duplicate = 'unavailable';
    }
    results.push({ originalBytes: file.size, uploadedBytes: webp.size,
      detections: converted.detections.length, originalSeverity: computeHazardScore(original).severity,
      severity: hazard.severity, score: hazard.total, duplicate });
  }
  // Score boundaries use detections, confidence and box area, with no model mocks.
  for (const [score, expected] of [[34,'aman'],[35,'sedang'],[69,'sedang'],[70,'darurat']]) {
    const result = computeHazardScore({ detections:[{damage_type:'pothole', confidence:score/70, bbox:[0,0,0,0]}], imageWidth:640, imageHeight:640 });
    assert(result.severity === expected, `Wrong severity at score ${score}`);
  }
  return {passed:true, samples:results};
})()
