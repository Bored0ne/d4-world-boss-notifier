import 'dotenv/config';
import {DateTime, Interval} from "luxon";
import axios from "axios";
import * as fs from "fs";
import * as Alexa from 'ask-sdk-core';
import * as AlexaModels from 'ask-sdk-model';
import {services} from "ask-sdk-model";
import ApiConfiguration = services.ApiConfiguration;
import CreateProactiveEventRequest = services.proactiveEvents.CreateProactiveEventRequest;

const {ProactiveEventsServiceClient} = AlexaModels.services.proactiveEvents;

const authenticationConfiguration = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET
}

class DataFile {
  eventTimeInSeconds;
  needsNotifying;
  boss;
}

interface Boss {
  name: string;
  expectedName: string;
  nextExpectedName: string;
  timestamp: number;
  expected: number;
  nextExpected: number;
  territory: string;
  zone: string;
}

interface Helltide {
  timestamp: number;
  zone: string;
  refresh: number;
}

interface Legion {
  timestamp: number;
  territory: string;
  zone: string;
  expected: number;
  nextExpected: number;
}

interface Whisper {
  quest: number;
  end: number;
}

interface Data {
  boss: Boss;
  helltide: Helltide;
  legion: Legion;
  whispers: Whisper[];
}

const fileName = "cronCache.json"
const timeUpdateUrl = "https://d4armory.io/api/events/recent";
let df: DataFile = {
  eventTimeInSeconds: null,
  needsNotifying: null,
  boss: null
};

function timeUntilEventIsLessThan15Min() {
  console.log('checking time until event')
  const now = DateTime.now();
  const eventTime = DateTime.fromSeconds(df?.eventTimeInSeconds);
  const minsRemaining = eventTime.diff(now, 'minutes').minutes
  return minsRemaining <= 20 && minsRemaining > 0;
}

function eventAlreadyHappened() {
  console.log('checking if event passed');
  const now = DateTime.now();
  const eventTime = DateTime.fromSeconds(df?.eventTimeInSeconds);
  const minsRemaining = eventTime.diff(now, 'minutes').minutes
  return minsRemaining < 0;
}

function needsNotifying() {
  return (df?.needsNotifying === true || df?.needsNotifying == null);
}

function fetchDF() {
  try {
    const fileContent = fs.readFileSync(fileName, 'utf-8');
    df = JSON.parse(fileContent);
  } catch (error) {
    console.error('Error reading or parsing cronCache.json:', error.message);
  }
}

async function sendNotificationToAlexa() {
  const now = DateTime.now();
  const eventTime = DateTime.fromSeconds(df.eventTimeInSeconds);
  const expiryTime = eventTime.plus({minutes: 5})

  const apiConfiguration: ApiConfiguration = {
    apiClient: new Alexa.DefaultApiClient(),
    apiEndpoint: 'https://api.amazonalexa.com',
    authorizationValue: ""
  }

  const client = new ProactiveEventsServiceClient(apiConfiguration, authenticationConfiguration);
  const msg = {
    "name": "AMAZON.MediaContent.Available",
    "payload": {
      "content": {
        "name": "localizedattribute:contentName",
        "contentType": "GAME"
      },
      "availability": {
        "method": "DROP",
        "startTime": eventTime.toString(),
        "provider": {
          "name": "localizedattribute:providerName"
        }
      },
    }
  }

  const createEvent: CreateProactiveEventRequest = {
    timestamp: now.toString(),
    referenceId: df.eventTimeInSeconds.toString(),
    expiryTime: expiryTime.toString(),
    event: msg,
    localizedAttributes: [{
      locale: 'en-US',
      providerName: 'Diablo 4',
      contentName: `The ${eventTime.toLocaleString(DateTime.TIME_SIMPLE)} world boss ${df.boss}`
    }],
    relevantAudience: {
      type: "Multicast",
      payload: {}
    }
  }

  const stage = "DEVELOPMENT";

  await client.createProactiveEvent(createEvent, stage);
  df.needsNotifying = false;
  try {
    const string = JSON.stringify(df, null, 2);
    fs.writeFileSync(fileName, string, 'utf-8');
  } catch (err) {
    console.error('There was a problem updating the df', err);
  }
}

async function updateDataFile() {
  await axios.get<Data>(timeUpdateUrl)
    .then(({data}) => {
      df.boss = data?.boss?.expectedName;
      df.eventTimeInSeconds = data?.boss?.expected;
      df.needsNotifying = true;
      const string = JSON.stringify(df, null, 2);
      fs.writeFileSync(fileName, string, 'utf-8');
    })
    .catch((err) => {
      console.error('There was a problem updating the df', err);
    })
}

(async function run() {
  if (fs.existsSync(fileName)) {
    console.log('file exists');
    fetchDF()
  } else {
    console.log('file does not exist');
    await updateDataFile();
  }
  if (needsNotifying() && timeUntilEventIsLessThan15Min()) {
    console.log('letting alexa know')
    await sendNotificationToAlexa();
  }
  if (eventAlreadyHappened() && !needsNotifying()) {
    console.log('updating file')
    await updateDataFile()
  }
})();
