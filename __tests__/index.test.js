import nock from 'nock';
import { fileURLToPath } from 'url';
import os from 'os';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import { expect } from '@jest/globals';
import loadPage from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const readFile = (filepath, encoding = 'utf-8') => fs.readFile(filepath, encoding);
const fixturesPath = path.join(__dirname, '..', '__fixtures__');
const getFixturePath = (fileName) => path.join(fixturesPath, fileName);

const baseUrl = 'https://page-loader.hexlet.repl.co/';
const pageUrl = new URL('/courses', baseUrl);

nock.disableNetConnect();
const scope = nock(baseUrl).persist();

let resourses = [
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

const assetPaths = resourses.map((asset) => asset.assetPath);

const pageFileName = 'page-loader-hexlet-repl-co-courses.html';

let downloadedFilesData = [];

let expectedPageContent;

let outputDirPath;
describe('Positive cases:', () => {
  beforeAll(async () => {
    expectedPageContent = await readFile(getFixturePath(pageFileName));

    resourses = await Promise.all(resourses.map(async (asset) => {
      const { assetPath, fixturePath } = asset;
      const fixtureData = await readFile(getFixturePath(fixturePath));

      return {
        assetPath,
        fixturePath,
        fixtureData,
      };
    }));

    resourses.forEach((asset) => {
      const { assetPath, fixtureData } = asset;

      scope
        .get(assetPath)
        .reply(200, fixtureData);
    });

    outputDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
    await loadPage(pageUrl.toString(), outputDirPath);

    const promises = resourses.map(async (asset) => {
      const { assetPath, fixturePath } = asset;

      return [
        assetPath,
        await readFile(path.join(outputDirPath, fixturePath)),
      ];
    });
    downloadedFilesData = Object.fromEntries(await Promise.all(promises));
  });

  test('Changed HTML should match expected', async () => {
    const actualPageContent = await readFile(path.join(outputDirPath, pageFileName));

    expect(actualPageContent).toBe(expectedPageContent);
  });

  test.each(assetPaths)('Check asset %s', async (assetPath) => {
    const { fixtureData } = resourses.find((asset) => asset.assetPath === assetPath);

    expect(downloadedFilesData[assetPath]).toEqual(fixtureData);
  });
});

describe('Negative cases:', () => {
  beforeEach(async () => {
    outputDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  describe('Filesystem errors:', () => {
    test('Non-existent output folder error', async () => {
      nock.enableNetConnect();

      await expect(loadPage(pageUrl.toString(), '/wrong-folder'))
        .rejects.toThrow('ENOENT');
    });

    test('Non-accessed output folder error', async () => {
      await fs.chmod(path.join(outputDirPath), 0o400);

      await expect(loadPage(pageUrl.toString(), outputDirPath))
        .rejects.toThrow('EACCES');
    });
  });

  describe('Network errors:', () => {
    test('Connection error (Non-existent domain)', async () => {
      const nonExistentUrl = new URL('/', 'https://non-existent-domain.test');
      const expectedErrorOutput = new Error('getaddrinfo ENOTFOUND non-existent-domain.test');

      nock(nonExistentUrl.origin).persist()
        .get(nonExistentUrl.pathname)
        .replyWithError(expectedErrorOutput);

      await expect(loadPage(nonExistentUrl.toString()))
        .rejects.toThrow(expectedErrorOutput);

      await expect(fs.access('non-existent-domain-test-.html')).rejects.toThrow(/ENOENT/);
      await expect(fs.access('non-existent-domain-test-_files')).rejects.toThrow(/ENOENT/);
    });
  });

  describe('HTTP errors:', () => {
    test.each([404, 500])('Response code: %d', async (responseCode) => {
      scope
        .get(`/${responseCode}`)
        .reply(responseCode);

      const errorUrl = new URL(responseCode, baseUrl);
      await expect(loadPage(errorUrl.toString(), outputDirPath))
        .rejects.toThrow(`Request failed with status code ${responseCode}`);

      await expect(fs.access(`page-loader-hexlet-repl-co-${responseCode}.html`)).rejects.toThrow(/ENOENT/);
      await expect(fs.access(`page-loader-hexlet-repl-co-${responseCode}_files`)).rejects.toThrow(/ENOENT/);
    });
  });
});
