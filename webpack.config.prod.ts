import * as webpack from 'webpack';
import * as UglifyJSPlugin from 'uglifyjs-webpack-plugin';
import { config as baseconfig } from './webpack.config';

export const config: webpack.Configuration = {
  ...baseconfig,
  devtool: 'source-map',
  entry: {
    app: [
      './src/index.tsx'
    ]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          'awesome-typescript-loader'
        ]
      },
      ...baseconfig.module!.rules
    ]
  },
  plugins: [
    ...baseconfig.plugins as webpack.Plugin[],
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production')
    }),
    new UglifyJSPlugin({
      parallel: true,
      uglifyOptions: {
        extractComments: true
      }
    })
  ]
};

// noinspection JSUnusedGlobalSymbols
export default config;