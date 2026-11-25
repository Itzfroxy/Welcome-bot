
require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  REST,
  Routes,
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField
} = require('discord.js');

const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const DATA_FILE = './data.json';

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '{}');
}

function getData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Set the welcome channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Select welcome channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),

  new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Test the welcome message')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
];

client.once('ready', async () => {
  console.log(`${client.user.tag} is online!`);

  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands.map(command => command.toJSON()) }
    );

    console.log('Welcome commands registered!');
  } catch (error) {
    console.error('Command registration error:', error);
  }
});

function createWelcomeEmbed(member) {
  return new EmbedBuilder()
    .setColor('#75D6A5')
    .setTitle(`Welcome to ${member.guild.name}!`)
    .setDescription(
      `Welcome ${member}!\n\n` +
      `We are happy to have you in our community.\n\n` +
      `You are member number **${member.guild.memberCount}**.`
    )
    .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: member.guild.name })
    .setTimestamp();
}

client.on('guildMemberAdd', async member => {
  try {
    const data = getData();
    const channelId = data[member.guild.id];

    if (!channelId) return;

    const channel = member.guild.channels.cache.get(channelId);

    if (!channel) return;

    await channel.send({
      embeds: [createWelcomeEmbed(member)]
    });
  } catch (error) {
    console.error('Welcome error:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'setwelcome') {
    const channel = interaction.options.getChannel('channel');

    const data = getData();
    data[interaction.guildId] = channel.id;
    saveData(data);

    return interaction.reply({
      content: `Welcome channel successfully set to ${channel}!`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'welcometest') {
    return interaction.reply({
      embeds: [createWelcomeEmbed(interaction.member)],
      ephemeral: true
    });
  }
});

client.login(process.env.TOKEN);
          
