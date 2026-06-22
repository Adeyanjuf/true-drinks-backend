import validatorIsEmail from 'validator/lib/isEmail';

const inputs = ['2j31e4i7b9@ruutukf.com', 'notaprob965@gmail.com'];

for (const input of inputs) {
  console.log(JSON.stringify(input), '->', validatorIsEmail(input));
}