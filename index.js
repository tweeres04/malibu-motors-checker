require('dotenv').config();

const scrapeIt = require('scrape-it');
const mailgunJs = require('mailgun-js');
const fs = require('fs');
const promisify = require('util').promisify;
const _ = require('lodash');
const cron = require('cron');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const mailgunKey = process.env.MAILGUN_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;

const mailgun = mailgunJs({ apiKey: mailgunKey, domain: mailgunDomain });

const baseUrl = 'http://www.malibumotorsvictoria.com';

const outputFile = 'data.json';

async function go() {
	let {
		data: { cars }
	} = await scrapeIt(`${baseUrl}/vehicles`, {
		cars: {
			listItem: '.vehicleInfo',
			data: {
				name: 'h3',
				url: {
					selector: 'a',
					attr: 'href'
				},
				id: {
					selector: 'a',
					attr: 'href',
					convert: url => url.match(/\/vehicles\?id=(\d+)/)[1]
				}
			}
		}
	});

	let existingIds;
	try {
		existingIds = JSON.parse(await readFile(outputFile, 'utf8'));
	} catch (err) {
		existingIds = [];
	}

	cars = _.differenceBy(cars, existingIds.map(id => ({ id })), 'id');
	const carsText = cars
		.map(({ name, url }) => `${name}: ${baseUrl}${url}`)
		.join('\n\n')
		.trim();

	if (carsText) {
		try {
			await mailgun.messages().send({
				from: 'mailbumotorschecker@tweeres.ca',
				to: 'tweeres04@gmail.com',
				text: carsText
			});
		} catch (err) {
			console.error(err);
			return;
		}
		console.log('Sent the notification');
		storeIds(cars, existingIds);
	} else {
		console.log('No new cars');
	}
}

async function storeIds(cars, existingIds) {
	const newIds = cars.map(car => car.id);
	const json = JSON.stringify([...existingIds, ...newIds], null, 2);

	await writeFile(outputFile, json);
}

cron.job('0 0 */12 * * *', go, null, true, 'America/Vancouver');

// cron.job('* * * * * *', go, null, true, 'America/Vancouver');
