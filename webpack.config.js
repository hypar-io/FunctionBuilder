//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/

const extensionConfig = {
  target: 'node',
  entry: './src/extension.ts', 
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode' 
  },
  resolve: {
    extensions: ['.ts', '.js', '.node']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      },
      {
        test: /\.node$/,
        use: 'node-loader'
      }
    ]
  }
};
module.exports = [extensionConfig];