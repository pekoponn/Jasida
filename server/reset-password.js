// Explicitly requested email-only recovery. This does NOT prove account
// ownership: enabling it allows anyone knowing an email to replace its password.
// Keep the admin credential server-side and fail closed unless opted in.
export function createResetPasswordHandler({ env, createAdmin }) {
  return async function resetPassword(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Gunakan POST.' });
    }
    if (env.ALLOW_EMAIL_ONLY_PASSWORD_RESET !== 'true' ||
      !(env.SUPABASE_URL || env.VITE_SUPABASE_URL) || !env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(503).json({ error: 'Reset sandi belum diaktifkan oleh pengelola.' });
    }
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: 'Data tidak valid.' }); }
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body?.password;
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Masukkan email yang valid.' });
    }
    if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Sandi harus terdiri dari 6–128 karakter.' });
    }
    if (password !== body.confirmation) {
      return res.status(400).json({ error: 'Konfirmasi sandi tidak cocok.' });
    }
    try {
      const admin = createAdmin();
      // generateLink resolves the existing auth user without sending an email.
      // Never expose its recovery token or URL to the caller.
      const { data, error } = await admin.generateLink({ type: 'recovery', email });
      if (error) {
        if (error.code === 'user_not_found') return res.status(404).json({ error: 'Email tidak terdaftar.' });
        return res.status(502).json({ error: 'Gagal memeriksa akun. Coba lagi nanti.' });
      }
      if (!data?.user?.id || data.user.email?.toLowerCase() !== email) {
        return res.status(404).json({ error: 'Email tidak terdaftar.' });
      }
      const { error: updateError } = await admin.updateUserById(data.user.id, { password });
      if (updateError) {
        return res.status(400).json({ error: 'Sandi gagal diperbarui. Gunakan sandi lain yang lebih kuat.' });
      }
      return res.status(200).json({ success: true });
    } catch {
      return res.status(502).json({ error: 'Layanan reset sandi tidak dapat dihubungi. Coba lagi nanti.' });
    }
  };
}
