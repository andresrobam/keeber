const alphaKeys = Array.from({ length: 26 }, (_, index) => {
  const letter = String.fromCharCode(65 + index)
  return { label: letter, zmk: `&kp ${letter}`, qmk: `KC_${letter}` }
})

const numberKeys = Array.from({ length: 10 }, (_, index) => {
  const digit = String(index)
  return { label: digit, zmk: `&kp N${digit}`, qmk: `KC_${digit}` }
})

const functionKeys = Array.from({ length: 12 }, (_, index) => {
  const keyNumber = index + 1
  return { label: `F${keyNumber}`, zmk: `&kp F${keyNumber}`, qmk: `KC_F${keyNumber}` }
})

export const KEY_GROUPS = [
  {
    title: 'Core',
    sections: [
      {
        title: 'Alphas',
        items: alphaKeys
      },
      {
        title: 'Numbers',
        items: numberKeys
      },
      {
        title: 'Punctuation',
        items: [
          { label: '-', zmk: '&kp MINUS', qmk: 'KC_MINS' },
          { label: '=', zmk: '&kp EQUAL', qmk: 'KC_EQL' },
          { label: '[', zmk: '&kp LBKT', qmk: 'KC_LBRC' },
          { label: ']', zmk: '&kp RBKT', qmk: 'KC_RBRC' },
          { label: '\\', zmk: '&kp BSLH', qmk: 'KC_BSLS' },
          { label: ';', zmk: '&kp SCLN', qmk: 'KC_SCLN' },
          { label: "'", zmk: '&kp QUOT', qmk: 'KC_QUOT' },
          { label: ',', zmk: '&kp COMM', qmk: 'KC_COMM' },
          { label: '.', zmk: '&kp DOT', qmk: 'KC_DOT' },
          { label: '/', zmk: '&kp SLSH', qmk: 'KC_SLSH' },
          { label: '`', zmk: '&kp GRAVE', qmk: 'KC_GRV' }
        ]
      },
      {
        title: 'Modifiers',
        items: [
          { label: 'L Ctrl', zmk: '&kp LCTRL', qmk: 'KC_LCTL' },
          { label: 'R Ctrl', zmk: '&kp RCTRL', qmk: 'KC_RCTL' },
          { label: 'L Shift', zmk: '&kp LSHFT', qmk: 'KC_LSFT' },
          { label: 'R Shift', zmk: '&kp RSHFT', qmk: 'KC_RSFT' },
          { label: 'L Alt', zmk: '&kp LALT', qmk: 'KC_LALT' },
          { label: 'R Alt', zmk: '&kp RALT', qmk: 'KC_RALT' },
          { label: 'L Gui', zmk: '&kp LGUI', qmk: 'KC_LGUI' },
          { label: 'R Gui', zmk: '&kp RGUI', qmk: 'KC_RGUI' },
          { label: 'Magic', zmk: '&magic', qmk: 'MAGIC' }
        ]
      },
      {
        title: 'Special',
        items: [{ label: 'Trans', zmk: '&trans', qmk: 'KC_TRNS' }]
      },
      {
        title: 'Navigation',
        items: [
          { label: 'Esc', zmk: '&kp ESC', qmk: 'KC_ESC' },
          { label: 'Tab', zmk: '&kp TAB', qmk: 'KC_TAB' },
          { label: 'Ent', zmk: '&kp ENTER', qmk: 'KC_ENTER' },
          { label: 'Spc', zmk: '&kp SPACE', qmk: 'KC_SPACE' },
          { label: 'Bksp', zmk: '&kp BSPC', qmk: 'KC_BSPC' },
          { label: 'Del', zmk: '&kp DEL', qmk: 'KC_DEL' },
          { label: 'Ins', zmk: '&kp INS', qmk: 'KC_INS' },
          { label: 'Home', zmk: '&kp HOME', qmk: 'KC_HOME' },
          { label: 'End', zmk: '&kp END', qmk: 'KC_END' },
          { label: 'PgUp', zmk: '&kp PG_UP', qmk: 'KC_PGUP' },
          { label: 'PgDn', zmk: '&kp PG_DN', qmk: 'KC_PGDN' },
          { label: 'Caps', zmk: '&kp CAPS', qmk: 'KC_CAPS' }
        ]
      },
      {
        title: 'Arrows',
        items: [
          { label: '↑', zmk: '&kp UP', qmk: 'KC_UP' },
          { label: '↓', zmk: '&kp DOWN', qmk: 'KC_DOWN' },
          { label: '←', zmk: '&kp LEFT', qmk: 'KC_LEFT' },
          { label: '→', zmk: '&kp RIGHT', qmk: 'KC_RGHT' }
        ]
      }
    ]
  },
  {
    title: 'Function Row',
    sections: [
      {
        title: 'F-Keys',
        items: functionKeys
      }
    ]
  },
  {
    title: 'Media/System',
    sections: [
      {
        title: 'Volume',
        items: [
          {
            label: 'Mute',
            zmk: '&kp C_MUTE',
            qmk: 'KC_MUTE',
            aliases: ['KC_AUDIO_MUTE']
          },
          {
            label: 'Vol+',
            zmk: '&kp C_VOL_UP',
            qmk: 'KC_VOLU',
            aliases: ['KC_AUDIO_VOL_UP']
          },
          {
            label: 'Vol-',
            zmk: '&kp C_VOL_DN',
            qmk: 'KC_VOLD',
            aliases: ['KC_AUDIO_VOL_DOWN']
          }
        ]
      },
      {
        title: 'Playback',
        items: [
          {
            label: 'Play',
            zmk: '&kp C_PLAY',
            qmk: 'KC_MPLY',
            aliases: ['KC_MEDIA_PLAY_PAUSE']
          },
          {
            label: 'Next',
            zmk: '&kp C_NEXT',
            qmk: 'KC_MNXT',
            aliases: ['KC_MEDIA_NEXT_TRACK']
          },
          {
            label: 'Prev',
            zmk: '&kp C_PREV',
            qmk: 'KC_MPRV',
            aliases: ['KC_MEDIA_PREV_TRACK']
          },
          {
            label: 'Stop',
            zmk: '&kp C_STOP',
            qmk: 'KC_MSTP',
            aliases: ['KC_MEDIA_STOP']
          }
        ]
      },
      {
        title: 'Brightness',
        items: [
          { label: 'Br+', zmk: '&kp C_BRI_UP', qmk: 'KC_BRIU' },
          { label: 'Br-', zmk: '&kp C_BRI_DOWN', qmk: 'KC_BRID' }
        ]
      },
      {
        title: 'System',
        items: [
          { label: 'Power', zmk: '&kp C_POWER', qmk: 'KC_POWER' },
          { label: 'Sleep', zmk: '&kp C_SLEEP', qmk: 'KC_SLEP' },
          { label: 'Wake', zmk: '&kp C_WAKE', qmk: 'KC_WAKE' }
        ]
      }
    ]
  }
]
