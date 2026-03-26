module.exports = (api) => {
  const isWeb = api.env('web');

  if (isWeb) {
    return {
      presets: [
        ['@babel/preset-env', { targets: { browsers: ['last 2 versions'] } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript',
      ],
      assumptions: {
        setPublicClassFields: true,
        privateFieldsAsProperties: true,
      },
      plugins: ['@babel/plugin-transform-runtime'],
      sourceType: 'unambiguous',
    };
  }

  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: ['transform-inline-environment-variables'],
  };
};
