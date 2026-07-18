export default {
  extends: ['@commitlint/config-conventional'],
  ignores: [commit => commit === 'Initial plan'],
  rules: {
    'body-max-line-length': [0, 'always'],
    'footer-max-line-length': [0, 'always'],
    'subject-case': [0]
  }
}
