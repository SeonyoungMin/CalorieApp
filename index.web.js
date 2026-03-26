import { AppRegistry } from 'react-native';
import App from './App';

AppRegistry.registerComponent('CalorieApp', () => App);
AppRegistry.runApplication('CalorieApp', {
  rootTag: document.getElementById('root'),
});
