module.exports = {
  plugins: {
    'postcss-import': {
      filter: (id) => !id.startsWith('http')
    },
    tailwindcss: {},
    autoprefixer: {}
  }
}

