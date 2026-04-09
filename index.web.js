import { AppRegistry, Alert } from 'react-native';
import App from './App';

// Polyfill Alert for web
Alert.alert = (title, message, buttons) => {
  if (!buttons || buttons.length === 0) {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  const cancelBtn = buttons.find(b => b.style === 'cancel');
  const confirmBtn = buttons.find(b => b.style !== 'cancel' && b.onPress);
  if (confirmBtn) {
    const ok = window.confirm(message ? `${title}\n\n${message}` : title);
    if (ok && confirmBtn.onPress) confirmBtn.onPress();
    else if (!ok && cancelBtn && cancelBtn.onPress) cancelBtn.onPress();
  } else {
    window.alert(message ? `${title}\n\n${message}` : title);
    if (buttons[0] && buttons[0].onPress) buttons[0].onPress();
  }
};

AppRegistry.registerComponent('CalorieApp', () => App);
AppRegistry.runApplication('CalorieApp', {
  rootTag: document.getElementById('root'),
});
