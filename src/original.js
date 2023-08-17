
import {DateTime, Duration, Interval} from 'luxon';
import * as Alexa from 'ask-sdk-core';
import * as AlexaModels from 'ask-sdk-model';

const {ProactiveEventsServiceClient} = AlexaModels.services.proactiveEvents;
// Create a new client instance
const client = new Client({intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]});

const authenticationConfiguration = {
  clientId: process.env.ALEXA_CLIENT_ID,
  clientSecret: process.env.ALEXA_CLIENT_SECRET
}
// Require the necessary discord.js classes
import {Client, Events, GatewayIntentBits} from 'discord.js';

const getTimeRegex = /<t:(\d*):T>/g


// When the client is ready, run this code (only once)
// We use 'c' for the event parameter to keep it separate from the already defined 'client'
client.once(Events.ClientReady, c => {
  console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.channelId === "1141722998504701954") {
    console.log(message.content);
    if (getTimeRegex.test(message.content)) {
      const times = getTimeRegex.exec(message.content);
      console.log(times[1]);
      const now = DateTime.now();
      const EventTime = DateTime.fromSeconds(parseInt(times[1]));
      const ExpiryTime = EventTime.plus({minutes: 5})

      const apiConfiguration = {
        apiClient: new Alexa.DefaultApiClient(),
        apiEndpoint: 'https://api.amazonalexa.com'
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
            "startTime": EventTime.toString(),
            "provider": {
              "name": "localizedattribute:providerName"
            }
          },
        }
      }

      const relevantAudience = {
        type: "Multicast",
        payload: {}
      }

      const createEvent = {
        timestamp: now.toString(),
        referenceId: message.id,
        expiryTime: ExpiryTime.toString(),
        event: msg,
        localizedAttributes: [{locale: 'en-US', providerName: 'Diablo 4', 'contentName': "World boss"}],
        relevantAudience
      }

      const stage = "DEVELOPMENT";

      await client.createProactiveEvent(createEvent, stage);
    }
  }
})

// Log in to Discord with your client's token
client.login(process.env.DISCORD_TOKEN);

