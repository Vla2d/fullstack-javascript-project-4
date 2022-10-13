import nock from 'nock';
import { fileURLToPath } from 'url';
import os from 'os';
import path, { dirname } from 'path';
import fs from 'fs/promises';
import loadPage from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const fixturesPath = path.join(__dirname, '..', '__fixtures__');
const getFixturePath = (fileName, assetsFolderName = '') => path.join(fixturesPath, assetsFolderName, fileName);
const readFile = (filepath) => fs.readFile(filepath, 'utf-8');

const pageUrl = new URL('/courses', 'https://page-loader.hexlet.repl.co/');

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

nock.disableNetConnect();
const scope = nock(pageUrl.origin).persist();

let tempDirPath;
beforeAll(async () => {
  tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
});

describe('Positive cases:', () => {
  beforeEach(async () => {
    Object.keys(assetsAndFixturesPathes).forEach((key) => {
      const { assetPath, fixturePath } = assetsAndFixturesPathes[key];

      scope
        .get(assetPath)
        .replyWithFile(200, getFixturePath(fixturePath));
    });
  });

  test('Changed HTML should match expected', async () => {
    await loadPage(pageUrl.toString(), tempDirPath);

    const fixtures = await fs.readdir(fixturesPath);
    const changedPageFixturePath = fixtures.find((el) => path.extname(el) === '.html');

    const changedPage = await readFile(path.join(tempDirPath, 'page-loader-hexlet-repl-co-courses.html'));
    expect(changedPage).toBe(await readFile(getFixturePath(changedPageFixturePath)));
  });

  test('Downloaded assets should match expected', async () => {
    await loadPage(pageUrl.toString(), tempDirPath);

    /* eslint-disable max-len */
    const downloadedImg = await readFile(path.join(tempDirPath, assetsAndFixturesPathes.img.fixturePath));
    const downloadedStyles = await readFile(path.join(tempDirPath, assetsAndFixturesPathes.styles.fixturePath));
    const downloadedScript = await readFile(path.join(tempDirPath, assetsAndFixturesPathes.script.fixturePath));
    const downloadedPage = await readFile(path.join(tempDirPath, assetsAndFixturesPathes.page.fixturePath));

    expect(downloadedImg).toEqual(await readFile(getFixturePath(assetsAndFixturesPathes.img.fixturePath)));
    expect(downloadedStyles).toEqual(await readFile(getFixturePath(assetsAndFixturesPathes.styles.fixturePath)));
    expect(downloadedScript).toEqual(await readFile(getFixturePath(assetsAndFixturesPathes.script.fixturePath)));
    expect(downloadedPage).toEqual(await readFile(getFixturePath(assetsAndFixturesPathes.page.fixturePath)));
    /* eslint-enable max-len */
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
    describe('HTTP error responses:', () => {
      test.each([404, 500])('Client error response: %d', async (responseCode) => {
        const errorUrl = new URL(responseCode, pageUrl.origin);

        scope
          .get(errorUrl.pathname)
          .reply(responseCode);

        await expect(loadPage(errorUrl.toString(), tempDirPath))
          .rejects.toThrow(`Request failed with status code ${responseCode}`);
      });
    });
  });
});
