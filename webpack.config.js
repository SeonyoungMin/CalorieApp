const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
  mode: 'development',
  entry: './index.web.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },
  devServer: {
    port: 8087,
    hot: true,
    open: true,
    historyApiFallback: true,
    proxy: [
      {
        context: ['/api', '/login', '/register', '/logout', '/auth'],
        target: 'http://54.252.162.73:8081',
        changeOrigin: true,
        autoRewrite: true,
        cookieDomainRewrite: 'localhost',
      },
      {
        context: ['/kfda'],
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        secure: true,
        pathRewrite: { '^/kfda': '' },
      },
    ],
  },
  resolve: {
    extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    conditionNames: ['require', 'node', 'default'],
    alias: {
      'react-native$': 'react-native-web',
      'react-native-svg': 'react-native-svg/src/ReactNativeSVG.web',
      'react-native-image-picker': path.resolve(__dirname, 'src/mocks/react-native-image-picker.js'),
      '@notifee/react-native': path.resolve(__dirname, 'src/mocks/notifee.js'),
      '@react-native-seoul/kakao-login': path.resolve(__dirname, 'src/mocks/kakao-login.web.js'),
      '@react-native-google-signin/google-signin': path.resolve(__dirname, 'src/mocks/google-signin.web.js'),
      '@env': path.resolve(__dirname, 'src/mocks/env.web.js'),
      'react-native-share': path.resolve(__dirname, 'src/mocks/react-native-share.js'),
      'react-native-view-shot': path.resolve(__dirname, 'src/mocks/react-native-view-shot.js'),
      'react-native-health-connect': path.resolve(__dirname, 'src/mocks/react-native-health-connect.js'),
    },
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(tsx?|jsx?)$/,
        exclude: (modulePath) => {
          if (!modulePath.includes('node_modules')) return false;
          const allowed = [
            '@react-navigation',
            'react-native-screens',
            'react-native-safe-area-context',
            'react-native-web',
            'react-native-svg',
            '@react-native',
            '@anthropic-ai',
            '@fortawesome',
          ];
          return !allowed.some(pkg => modulePath.includes(pkg));
        },
        use: {
          loader: 'babel-loader',
          options: {
            envName: 'web',
          },
        },
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html',
    }),
    new Dotenv(),
  ],
};
