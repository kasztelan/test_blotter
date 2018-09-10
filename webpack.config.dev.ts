import * as webpack from 'webpack';
import { config as baseconfig } from './webpack.config';

export const config: webpack.Configuration = {
  ...baseconfig,
  entry: {
    app: [
      './src/index.tsx'
    ]
  },
  mode: 'development',
  devtool: 'cheap-module-eval-source-map',
  devServer: {
    contentBase: './dist'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              babelrc: true
            }
          },
          'awesome-typescript-loader'
        ]
      },
      ...baseconfig.module!.rules
    ]
  },
  plugins: [
    ...baseconfig.plugins as webpack.Plugin[]
  ]
};

// noinspection JSUnusedGlobalSymbols
export default config;