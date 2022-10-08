import nock from 'nock';
import { fileURLToPath } from 'url';
import os from 'os';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import loadPage from '../src/index.js';
import { getErrorType } from '../src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = path.join(__dirname, '..', '__fixtures__');
const getFixturePath = (fileName, assetsFolderName = '') => path.join(fixturesPath, assetsFolderName, fileName);
const readFile = (filepath) => fs.readFile(filepath, 'utf-8');

const pageUrl = new URL('/courses', 'https://ru.hexlet.io/');

nock.disableNetConnect();
const scope = nock(pageUrl.origin).persist();

let tempDirPath;
beforeAll(async () => {
  tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('Positive cases:', () => {
  let expectedDownloadedImage;
  let expectedChangedPage;

  beforeEach(async () => {
    const fixtures = await fs.readdir(fixturesPath);
    const downloadedAssetsFolder = fixtures.find((el) => !path.extname(el));
    const downloadedAssets = await fs.readdir(getFixturePath(downloadedAssetsFolder));

    const expectedChangedPageName = fixtures.find((el) => path.extname(el) === '.html');
    const expectedDownloadedImageName = downloadedAssets.find((el) => new RegExp(/\.(gif|jpe?g|tiff?|png|webp|bmp)$/, 'i').test(path.extname(el)));

    // eslint-disable-next-line max-len
    expectedDownloadedImage = await readFile(getFixturePath(expectedDownloadedImageName, downloadedAssetsFolder));
    expectedChangedPage = await readFile(getFixturePath(expectedChangedPageName));
  });

  test('Changed HTML should match expected', async () => {
    scope
      .get(pageUrl.pathname)
      .replyWithFile(200, getFixturePath('ru-hexlet-io-courses_files/ru-hexlet-io-courses.html'))
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('ru-hexlet-io-courses_files/ru-hexlet-io-assets-nodejs.png'));

    await loadPage(pageUrl.toString(), tempDirPath);

    const changedPage = await readFile(path.join(tempDirPath, 'ru-hexlet-io-courses.html'));
    expect(changedPage).toBe(expectedChangedPage);
  });

  test('Downloaded assets should match expected', async () => {
    scope
      .get('/assets/professions/nodejs.png')
      .replyWithFile(200, getFixturePath('ru-hexlet-io-courses_files/ru-hexlet-io-assets-nodejs.png'));

    await loadPage(pageUrl.toString(), tempDirPath);

    const downloadedImg = await readFile(path.join(tempDirPath, 'ru-hexlet-io-courses_files', 'ru-hexlet-io-assets-professions-nodejs.png'));
    expect(downloadedImg).toEqual(expectedDownloadedImage);
  });
});

describe('Negative cases:', () => {
  describe('Filesystem errors:', () => {
    test('Non-existent output folder', async () => {
      await expect(loadPage(pageUrl.toString(), '/wrong-folder'))
        .rejects.toThrow('ENOENT');
    });

    test('Non-accessed output folder', async () => {
      await fs.chmod(path.join(tempDirPath), 0o400);

      await expect(loadPage(pageUrl.toString(), tempDirPath))
        .rejects.toThrow('EACCES');
    });
  });

  describe('Network errors:', () => {
    test.each([404, 500, 1])('Client error response: %d', async (responseCode) => {
      const errorUrl = new URL(responseCode, pageUrl.origin);
      scope
        .get(errorUrl.pathname)
        .reply(responseCode);

      const errType = getErrorType(responseCode);

      await expect(loadPage(errorUrl.toString(), tempDirPath))
        .rejects.toThrow(`Request failed with status code ${responseCode}. ${errType} error.`);
    });
  });
});
