// Web mock for react-native-image-picker
export const launchImageLibrary = (options, callback) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const uri = URL.createObjectURL(file);
      callback({ assets: [{ uri, fileName: file.name, type: file.type }] });
    }
  };
  input.click();
};

export const launchCamera = (options, callback) => {
  callback({ errorCode: 'camera_unavailable', errorMessage: 'Camera not available on web' });
};

export default { launchImageLibrary, launchCamera };
