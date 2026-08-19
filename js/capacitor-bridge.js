/* HomeSync AI native bridge.
 * Safe to load on web, Android and iOS. The web app remains the source of truth.
 */
(() => {
  const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
  document.documentElement.classList.toggle('homesync-native', isNative);
  if (!isNative) return;

  document.documentElement.classList.add('homesync-mobile');

  // Keep the existing Supabase auth/session model. Native plugins are optional;
  // failures here must never prevent the web application from loading.
  const boot = async () => {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: Style.Dark });
    } catch (_) {}

    try {
      const { Keyboard } = await import('@capacitor/keyboard');
      await Keyboard.setResizeMode({ mode: 'body' });
    } catch (_) {}
  };

  boot();
})();
