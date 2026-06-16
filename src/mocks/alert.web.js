// Web-compatible Alert polyfill
const Alert = {
  alert: (title, message, buttons) => {
    const text = message ? `${title}\n\n${message}` : title;
    if (!buttons || buttons.length === 0) {
      window.alert(text);
      return;
    }
    const cancelBtn = buttons.find(b => b.style === 'cancel');
    const confirmBtn = buttons.find(b => b.style !== 'cancel' && b.onPress);
    if (confirmBtn) {
      const ok = window.confirm(text);
      if (ok && confirmBtn.onPress) confirmBtn.onPress();
      else if (!ok && cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
    } else {
      window.alert(text);
      const firstWithPress = buttons.find(b => b.onPress);
      if (firstWithPress) firstWithPress.onPress();
    }
  },
};

export { Alert };
export default Alert;
