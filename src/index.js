import path from 'path';
import fs from 'fs/promises';
import debug from 'debug';
import axios from 'axios';
import 'axios-debug-log';
import Listr from 'listr';
import {
  transformUrlToDirName,
  transformUrlToFileName,
  extractAssets,
  writeFile,
  downloadAsset,
} from './utils.js';

const log = debug('page-loader');

const loadPage = (url, outputDirPath = '') => {
  log(`Page loader has started with url: ${url}, outputDirpath: ${outputDirPath}`);
  const pageUrl = new URL(url);
  const pageFileName = transformUrlToFileName(pageUrl);
  const dirName = transformUrlToDirName(pageUrl);
  const pageFilePath = path.join(outputDirPath, pageFileName);
  const dirPath = path.join(outputDirPath, dirName);

  return axios.get(url)
    .then(({ data: html }) => {
      log(`Assets directory path: '${dirPath}'`);

      return fs.access(dirPath)
        .catch(() => fs.mkdir(dirPath))
        .then(() => html);
    })
    .then((html) => {
      log('Extracting assets...');

      return extractAssets(html, pageUrl, dirName);
    })
    .then(({ html, assets }) => {
      log(`HTML page path: '${pageFilePath}'`);

      return writeFile(pageFilePath, html)
        .then(() => assets);
    })
    .then((assets) => {
      const tasks = assets.map(({ assetUrl, name }) => {
        const assetPath = path.resolve(dirPath, name);
        // console.log(path.extname(assetPath)) // reg exp ???????
        return {
          title: `Downloading asset: ${assetUrl.toString()}`,
          task: () => downloadAsset(assetUrl.toString(), assetPath),
        };
      });

      return new Listr(tasks, { concurrent: true }).run();
    })
    .then(() => pageFilePath);
};

export default loadPage;
