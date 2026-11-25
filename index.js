
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

const admin = PermissionsBitField.Flags.ManageGuild;

const commands = [
  new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Set welcome channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Welcome channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcomemessage')
    .setDescription('Edit welcome message')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('New welcome message')
        .setMaxLength(4000)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcometitle')
    .setDescription('Edit welcome embed title')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('New welcome title')
        .setMaxLength(256)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcomecolor')
    .setDescription('Change welcome embed color')
    .addStringOption(option =>
      option.setName('color')
        .setDescription('Hex color, example #FF0000')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Preview welcome message')
    .setDefaultMemberPermissions(admin)
];

function getConfig(guildId) {
  const data = getData();

  return data[guildId] || {
    channel: null,
    message: 'Welcome {user} to {server}!',
    title: 'Welcome to {server}!',
    color: '#75D6A5'
  };
}

function createWelcomeEmbed(member) {
  const config = getConfig(member.guild.id);

  const replace = text => text
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));

  return new EmbedBuilder()
    .setColor(config.color)
    .setTitle(replace(config.title))
    .setDescription(replace(config.message))
    .setThumbnail(
      member.user.displayAvatarURL({ size: 256 })
    )
    .setFooter({ text: member.guild.name })
    .setTimestamp();
}

client.once('ready', async () => {
  console.log(`${client.user.tag} is online!`);

  try {
    const rest = new REST({ version: '10' })
      .setToken(process.env.TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      {
        body: commands.map(command => command.toJSON())
      }
    );

    console.log('Welcome commands registered!');
  } catch (error) {
    console.error('Command registration error:', error);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const config = getConfig(member.guild.id);

    if (!config.channel) return;

    const channel = await member.guild.channels.fetch(
      config.channel
    );

    if (!channel || !channel.isTextBased()) return;

    await channel.send({
      embeds: [createWelcomeEmbed(member)]
    });
  } catch (error) {
    console.error('Welcome error:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.guild) return;

  const guildId = interaction.guildId;
  const data = getData();

  if (!data[guildId]) {
    data[guildId] = {
      channel: null,
      message: 'Welcome {user} to {server}!',
      title: 'Welcome to {server}!',
      color: '#75D6A5'
    };
  }

  const config = data[guildId];

  if (interaction.commandName === 'setwelcome') {
    config.channel = interaction.options.getChannel('channel').id;
    saveData(data);

    return interaction.reply({
      content: 'Welcome channel updated successfully!',
      ephemeral: true
    });
  }

  if (interaction.commandName === 'welcomemessage') {
    config.message = interaction.options.getString('message');
    saveData(data);

    return interaction.reply({
      content: 'Welcome message updated successfully!',
      ephemeral: true
    });
  }

  if (interaction.commandName === 'welcometitle') {
    config.title = interaction.options.getString('title');
    saveData(data);

    return interaction.reply({
      content: 'Welcome title updated successfully!',
      ephemeral: true
    });
  }

  if (interaction.commandName === 'welcomecolor') {
    const color = interaction.options.getString('color');

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return interaction.reply({
        content: 'Invalid color! Use HEX format like #FF0000.',
        ephemeral: true
      });
    }

    config.color = color;
    saveData(data);

    return interaction.reply({
      content: 'Welcome embed color updated!',
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
