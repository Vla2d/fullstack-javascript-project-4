import nock from 'nock';
import { fileURLToPath } from 'url';
import os from 'os';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import { beforeAll } from '@jest/globals';
import loadPage from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const readFile = (filepath, encoding = 'utf-8') => fs.readFile(filepath, encoding);
const readDir = (dirpath) => fs.readdir(dirpath);
const fixturesPath = path.join(__dirname, '..', '__fixtures__');
const getFixturePath = (fileName, assetsFolderName = '') => path.join(fixturesPath, assetsFolderName, fileName);

const pageUrl = new URL('/courses', 'https://page-loader.hexlet.repl.co/');

nock.disableNetConnect();
const scope = nock(pageUrl.origin).persist();

let tempDirPath;
beforeAll(async () => {
  tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

const assetsAndFixturesPathes = {
  page: {
    assetPath: '/courses',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-courses.html',
  },
  img: {
    assetPath: '/assets/professions/nodejs.png',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-assets-professions-nodejs.png',
  },
  styles: {
    assetPath: '/assets/application.css',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-assets-application.css',
  },
  script: {
    assetPath: '/script.js',
    fixturePath: 'page-loader-hexlet-repl-co-courses_files/page-loader-hexlet-repl-co-script.js',
  },
};

const downloadedAndFixtureAssetsData = {
  page: {
    downloadedFile: '',
    fixtureFile: '',
  },
  img: {
    downloadedFile: '',
    fixtureFile: '',
  },
  styles: {
    downloadedFile: '',
    fixtureFile: '',
  },
  script: {
    downloadedFile: '',
    fixtureFile: '',
  },
};

const changedPage = {
  actualChangedPageFile: '',
  fixtureChangedPageFile: '',
};

describe('Positive cases:', () => {
  beforeAll(async () => {
    Object.keys(assetsAndFixturesPathes).forEach((key) => {
      const { assetPath, fixturePath } = assetsAndFixturesPathes[key];

      scope
        .get(assetPath)
        .replyWithFile(200, getFixturePath(fixturePath));
    });

    await loadPage(pageUrl.toString(), tempDirPath);
    Object.keys(downloadedAndFixtureAssetsData).forEach(async (key) => {
      const { fixturePath } = assetsAndFixturesPathes[key];
      const fileType = downloadedAndFixtureAssetsData[key];

      fileType.fixtureFile = await readFile(getFixturePath(fixturePath));
      fileType.downloadedFile = await readFile(path.join(tempDirPath, fixturePath));
    });

    const fixtures = await readDir(fixturesPath);
    const changedPageFixturePath = fixtures.find((el) => path.extname(el) === '.html');
    changedPage.actualChangedPageFile = await readFile(path.join(tempDirPath, 'page-loader-hexlet-repl-co-courses.html'));
    changedPage.fixtureChangedPageFile = await readFile(getFixturePath(changedPageFixturePath));
  });

  test('Changed HTML should match expected', async () => {
    expect(changedPage.actualChangedPageFile).toBe(changedPage.fixtureChangedPageFile);
  });

  test.each(Object.keys(downloadedAndFixtureAssetsData))('Downloaded assets should match expected', async (fileType) => {
    const { downloadedFile, fixtureFile } = downloadedAndFixtureAssetsData[fileType];

    expect(downloadedFile).toEqual(fixtureFile);
  });
});

describe('Negative cases:', () => {
  describe('Filesystem errors:', () => {
    test('Non-existent output folder', async () => {
      nock.enableNetConnect();

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

    test('Connection error', async () => {
      const nonExistentUrl = new URL(undefined, pageUrl.origin);

      scope
        .get(nonExistentUrl.pathname)
        .replyWithError('some-error');

      await expect(loadPage(nonExistentUrl.toString()))
        .rejects.toThrow();
    });
  });
});
