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
    port: 8082,
    hot: true,
    open: true,
    proxy: [
      {
        context: ['/api', '/login', '/register', '/logout'],
        target: 'http://54.206.26.66:8081',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
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
