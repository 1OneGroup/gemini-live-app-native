'use strict';

const LAYOUT    = require('./layout.html');
const STYLES    = require('./styles.css');
const STATE     = require('./client/state');
const CAMPAIGNS = require('./client/campaigns');
const CALLS     = require('./client/calls');
const PROMPTS   = require('./client/prompts');
const ANALYTICS = require('./client/analytics');
const BROCHURES = require('./client/brochures');
const SETTINGS  = require('./client/settings');
const BOOTSTRAP = require('./bootstrap');

// Original <script> order:
//   state, navigation, campaigns, calls, prompts, analytics,
//   brochures, health, settings, utils, init
// BOOTSTRAP = { nav, health, utils, init }
//
// Layout structure:
//   LAYOUT.part1 = <!DOCTYPE...> through '  <style>\n'
//   STYLES       = CSS content (between <style> and </style>)
//   LAYOUT.part2 = '\n  </style>\n</head>\n<body>...\n  <script>\n'
//   clientScript = all JS (between <script> and </script>)
//   LAYOUT.part3 = '\n  <\/script>\n</body>\n</html>'

function getDashboardHtml() {
  const clientScript =
    STATE            + '\n' +
    BOOTSTRAP.nav    + '\n' +
    CAMPAIGNS        + '\n' +
    CALLS            + '\n' +
    PROMPTS          + '\n' +
    ANALYTICS        + '\n' +
    BROCHURES        + '\n' +
    BOOTSTRAP.health + '\n' +
    SETTINGS         + '\n' +
    BOOTSTRAP.utils  + '\n' +
    BOOTSTRAP.init;

  return LAYOUT.part1 + STYLES + LAYOUT.part2 + clientScript + LAYOUT.part3;
}

module.exports = { getDashboardHtml };
