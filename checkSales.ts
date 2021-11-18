import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";
import { parseISO } from 'date-fns'


const discordBot = new Discord.Client();
const  discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
      resolve(channel as TextChannel);
    });
  })
}

const buildMessage = async (sale: any) => {
  const tokenMetadata = await fetch(`https://api.hyaliko.com/space-factory/tokens/${sale?.asset?.token_id}`).then((res: any) => res.json());
  
  return new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(tokenMetadata?.name)
	.setURL(sale?.asset?.permalink)
	.setAuthor('OpenSea Bot', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png', 'https://github.com/sbauch/opensea-discord-bot')
	.setThumbnail(tokenMetadata?.image_url)
	.addFields(
		{ name: 'Name', value: tokenMetadata?.name },
		{ name: 'Minter', value: sale?.to_account?.user?.username || sale?.to_account?.address, }
	)
  .setImage(sale.asset.image_url)
	.setTimestamp(Date.parse(`${sale?.created_date}Z`))
	.setFooter('Sold on OpenSea', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png')
}

async function main() {
  const channel = await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds)); // in the last hour, run hourly?
  
  const headers = {};
  if (process.env.API_KEY!) {
    headers['X-API-KEY'] = process.env.API_KEY!;
  }
  const openSeaResponse = await fetch(
    "https://api.opensea.io/api/v1/events?" + new URLSearchParams({
      offset: '0',
      limit: '100',
      event_type: 'transfer',
      only_opensea: 'false',
      occurred_after: hoursAgo.toString(), 
      collection_slug: process.env.COLLECTION_SLUG!,
      asset_contract_address: process.env.CONTRACT_ADDRESS!
  }), headers).then((resp) => resp.json());

  await Promise.all(
    openSeaResponse?.asset_events?.filter((e: any) => e.from_account.address === '0x0000000000000000000000000000000000000000').reverse().map(async (sale: any) => {
      const message = await buildMessage(sale);
      return channel.send(message)
    })
  );   
}

main()
  .then((res) =>{ 
    console.warn(res)
    process.exit(0)
  })
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
