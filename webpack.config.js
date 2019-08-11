//@ts-check

'use strict';

const path = require('path');

/**@type {import('webpack').Configuration}*/
const viewConfig = {
  target: 'web',
  entry: './src/view.ts', 
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'view.js',
    libraryTarget: 'umd',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
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
      }
    ]
  }
};

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
module.exports = [viewConfig, extensionConfig];