// Web mock for react-native-view-shot
import React from 'react';
import { View } from 'react-native';

const ViewShot = React.forwardRef(({ children, style, ...props }, ref) => {
  if (ref) {
    if (typeof ref === 'function') {
      ref({ capture: () => Promise.resolve('') });
    } else {
      ref.current = { capture: () => Promise.resolve('') };
    }
  }
  return React.createElement(View, { style, ...props }, children);
});

ViewShot.displayName = 'ViewShot';

export default ViewShot;
export const captureRef = () => Promise.resolve('');
export const captureScreen = () => Promise.resolve('');
