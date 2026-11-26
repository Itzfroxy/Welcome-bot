
require('dotenv').config();

const fs = require('fs');
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const FILE = './data.json';

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, '{}');
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

const defaults = {
  channel: null,
  title: 'Welcome to {server}!',
  message: 'Hey {user}, welcome to **{server}**! You are member #{count}.',
  color: '#57F287',
  randomColor: false,
  image: null
};

function getConfig(guildId) {
  const data = loadData();

  if (!data[guildId]) {
    data[guildId] = { ...defaults };
    saveData(data);
  }

  return { ...defaults, ...data[guildId] };
}

function updateConfig(guildId, changes) {
  const data = loadData();
  data[guildId] = {
    ...defaults,
    ...data[guildId],
    ...changes
  };
  saveData(data);
}

const admin = PermissionsBitField.Flags.ManageGuild;

const commands = [
  new SlashCommandBuilder()
    .setName('setwelcome')
    .setDescription('Set the welcome channel')
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('Welcome channel')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcomemessage')
    .setDescription('Edit the welcome message')
    .addStringOption(option =>
      option.setName('message')
        .setDescription('Use {user}, {server}, {count}')
        .setMaxLength(4000)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcometitle')
    .setDescription('Edit welcome title')
    .addStringOption(option =>
      option.setName('title')
        .setDescription('New welcome title')
        .setMaxLength(256)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcomecolor')
    .setDescription('Set a color or random colors')
    .addStringOption(option =>
      option.setName('color')
        .setDescription('HEX color like #FF0000 or random')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcomeimage')
    .setDescription('Set a welcome background image')
    .addStringOption(option =>
      option.setName('url')
        .setDescription('Direct image URL')
        .setRequired(true)
    )
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('clearwelcomeimage')
    .setDescription('Remove welcome background image')
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcometest')
    .setDescription('Preview the welcome embed')
    .setDefaultMemberPermissions(admin),

  new SlashCommandBuilder()
    .setName('welcomeconfig')
    .setDescription('Show current welcome settings')
    .setDefaultMemberPermissions(admin)
];

function randomHexColor() {
  return '#' + Math.floor(Math.random() * 16777215)
    .toString(16).padStart(6, '0');
}

function replaceVariables(text, member) {
  return text
    .replaceAll('{user}', `<@${member.id}>`)
    .replaceAll('{username}', member.user.username)
    .replaceAll('{server}', member.guild.name)
    .replaceAll('{count}', String(member.guild.memberCount));
}

function makeEmbed(member) {
  const config = getConfig(member.guild.id);

  const color = config.randomColor
    ? randomHexColor()
    : config.color;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(replaceVariables(config.title, member))
    .setDescription(replaceVariables(config.message, member))
    .setThumbnail(member.user.displayAvatarURL({
      extension: 'png',
      size: 512
    }))
    .setFooter({
      text: `Welcome to ${member.guild.name}`
    })
    .setTimestamp();

  if (config.image) {
    embed.setImage(config.image);
  }

  return embed;
}

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);

  if (!process.env.CLIENT_ID || !process.env.GUILD_ID) {
    console.error('Missing CLIENT_ID or GUILD_ID environment variable!');
    return;
  }

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

    console.log('SUCCESS: All welcome slash commands registered!');
  } catch (error) {
    console.error('SLASH COMMAND REGISTRATION FAILED:', error);
  }
});

client.on('guildMemberAdd', async member => {
  try {
    const config = getConfig(member.guild.id);

    if (!config.channel) {
      console.log(`No welcome channel set for ${member.guild.name}`);
      return;
    }

    const channel = await member.guild.channels.fetch(config.channel);

    if (!channel || !channel.isTextBased()) return;

    await channel.send({
      embeds: [makeEmbed(member)],
      allowedMentions: {
        users: [member.id]
      }
    });

    console.log(`Welcome sent for ${member.user.tag}`);
  } catch (error) {
    console.error('WELCOME ERROR:', error);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) return;

  if (!interaction.memberPermissions?.has(admin)) {
    return interaction.reply({
      content: 'You need Manage Server permission to use this command.',
      ephemeral: true
    });
  }

  const guildId = interaction.guildId;
  const config = getConfig(guildId);
  const command = interaction.commandName;

  try {
    if (command === 'setwelcome') {
      const channel = interaction.options.getChannel('channel');

      updateConfig(guildId, { channel: channel.id });

      return interaction.reply({
        content: `Welcome channel set to ${channel}.`,
        ephemeral: true
      });
    }

    if (command === 'welcomemessage') {
      const message = interaction.options.getString('message');

      updateConfig(guildId, { message });

      return interaction.reply({
        content: 'Welcome message updated successfully!',
        ephemeral: true
      });
    }

    if (command === 'welcometitle') {
      const title = interaction.options.getString('title');

      updateConfig(guildId, { title });

      return interaction.reply({
        content: 'Welcome title updated successfully!',
        ephemeral: true
      });
    }

    if (command === 'welcomecolor') {
      const color = interaction.options.getString('color').trim();

      if (color.toLowerCase() === 'random') {
        updateConfig(guildId, { randomColor: true });

        return interaction.reply({
          content: 'Random welcome colors enabled!',
          ephemeral: true
        });
      }

      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return interaction.reply({
          content: 'Invalid color! Use #FF0000 or type random.',
          ephemeral: true
        });
      }

      updateConfig(guildId, {
        color,
        randomColor: false
      });

      return interaction.reply({
        content: `Welcome color changed to ${color}.`,
        ephemeral: true
      });
    }

    if (command === 'welcomeimage') {
      const url = interaction.options.getString('url').trim();

      if (!/^https:\/\/\S+$/i.test(url)) {
        return interaction.reply({
          content: 'Please provide a valid HTTPS image URL.',
          ephemeral: true
        });
      }

      updateConfig(guildId, { image: url });

      return interaction.reply({
        content: 'Welcome background image updated!',
        ephemeral: true
      });
    }

    if (command === 'clearwelcomeimage') {
      updateConfig(guildId, { image: null });

      return interaction.reply({
        content: 'Welcome background image removed!',
        ephemeral: true
      });
    }

    if (command === 'welcometest') {
      return interaction.reply({
        embeds: [makeEmbed(interaction.member)],
        allowedMentions: { parse: [] },
        ephemeral: true
      });
    }

    if (command === 'welcomeconfig') {
      const current = getConfig(guildId);

      return interaction.reply({
        content:
          `**Welcome Channel:** ${current.channel ? `<#${current.channel}>` : 'Not set'}\n` +
          `**Title:** ${current.title}\n` +
          `**Message:** ${current.message}\n` +
          `**Color:** ${current.randomColor ? 'Random' : current.color}\n` +
          `**Background Image:** ${current.image ? 'Set' : 'Not set'}`,
        ephemeral: true
      });
    }
  } catch (error) {
    console.error('COMMAND ERROR:', error);

    const reply = {
      content: 'Something went wrong. Check the hosting logs.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      return interaction.followUp(reply);
    }

    return interaction.reply(reply);
  }
});

client.on('error', error => {
  console.error('Discord client error:', error);
});

if (!process.env.TOKEN) {
  console.error('TOKEN environment variable is missing!');
  process.exit(1);
}

client.login(process.env.TOKEN).catch(error => {
  console.error('LOGIN FAILED:', error);
  process.exit(1);
});
                        
