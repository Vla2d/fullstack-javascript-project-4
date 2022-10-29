import nock from 'nock';
import { fileURLToPath } from 'url';
import os from 'os';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import loadPage from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const readFile = (filepath, encoding = 'utf-8') => fs.readFile(filepath, encoding);
const fixturesPath = path.join(__dirname, '..', '__fixtures__');
const getFixturePath = (fileName, assetsFolderName = '') => path.join(fixturesPath, assetsFolderName, fileName);

const pageUrl = new URL('/courses', 'https://page-loader.hexlet.repl.co/');

nock.disableNetConnect();
const scope = nock(pageUrl.origin).persist();

let assets = [
  {
    assetPath: '/courses',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-courses.html',
    fixtureData: '',
  },
  {
    assetPath: '/assets/professions/nodejs.png',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-assets-professions-nodejs.png',
    fixtureData: '',
  },
  {
    assetPath: '/assets/application.css',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-assets-application.css',
    fixtureData: '',
  },
  {
    assetPath: '/script.js',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-script.js',
    fixtureData: '',
  },
];

const transformedPageFixturePath = 'page-loader-hexlet-repl-co-courses.html';

let downloadedFilesData;

let expectedPageContent;

let tempDirPath;
beforeAll(async () => {
  tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});
describe('Positive cases:', () => {
  beforeAll(async () => {
    assets = await Promise.all(assets.map(async (asset) => {
      const { assetPath, fixturePath } = asset;
      const fixtureData = await readFile(getFixturePath(fixturePath));

      return {
        assetPath,
        fixturePath,
        fixtureData,
      };
    }));

    assets.forEach((asset) => {
      const { assetPath, fixtureData } = asset;

      scope
        .get(assetPath)
        .reply(200, fixtureData);
    });

    await loadPage(pageUrl.toString(), tempDirPath);

    const promises = assets.map(async (asset) => {
      const { fixturePath } = asset;

      return [
        fixturePath,
        await readFile(path.join(tempDirPath, fixturePath)),
      ];
    });
    downloadedFilesData = Object.fromEntries(await Promise.all(promises));

    expectedPageContent = await readFile(getFixturePath(transformedPageFixturePath));
  });

  test('Changed HTML should match expected', async () => {
    const actualPageContent = await readFile(path.join(tempDirPath, transformedPageFixturePath));

    expect(actualPageContent).toBe(expectedPageContent);
  });

  test('Downloaded assets should match expected', async () => {
    Object.keys(downloadedFilesData).forEach((fileType) => {
      const { downloadedFile, fixtureFile } = downloadedFilesData[fileType];

      expect(downloadedFile).toEqual(fixtureFile);
    });
  });
});

describe('Negative cases:', () => {
  describe('Filesystem errors:', () => {
    test('Non-existent output folder error', async () => {
      nock.enableNetConnect();

      await expect(loadPage(pageUrl.toString(), '/wrong-folder'))
        .rejects.toThrow('ENOENT');
    });

    test('Non-accessed output folder error', async () => {
      await fs.chmod(path.join(tempDirPath), 0o400);

      await expect(loadPage(pageUrl.toString(), tempDirPath))
        .rejects.toThrow('EACCES');
    });
  });

  let doesDirectoryExist;
  describe('Network errors:', () => {
    afterEach(async () => {
      try {
        const directory = await fs.opendir(tempDirPath);
        const entry = await directory.read();
        await directory.close();

        doesDirectoryExist = entry === null;
      } catch (error) {
        doesDirectoryExist = false;
      }
    });

    describe('HTTP errors:', () => {
      test.each([404, 500])('Client error response: %d', async (responseCode) => {
        const errorUrl = new URL(responseCode, pageUrl.origin);

        scope
          .get(errorUrl.pathname)
          .reply(responseCode);

        await expect(loadPage(errorUrl.toString(), tempDirPath))
          .rejects.toThrow(`Request failed with status code ${responseCode}`);
      });
    });

    test('Connection error (Non-existent domain)', async () => {
      const nonExistentUrl = new URL('/', 'https://non-existent-domain.test');
      const expectedErrorOutput = new Error('getaddrinfo ENOTFOUND non-existent-domain.test');

      nock(nonExistentUrl.origin).persist()
        .get(nonExistentUrl.pathname)
        .replyWithError(expectedErrorOutput);

      await expect(loadPage(nonExistentUrl.toString()))
        .rejects.toThrow(expectedErrorOutput);
    });
  });

  test('New derictory should not be created after failed execution', () => {
    expect(doesDirectoryExist).toBeFalsy();
  });
});
