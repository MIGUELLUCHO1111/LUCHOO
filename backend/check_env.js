import dotenv from 'dotenv';
dotenv.config();

console.log('Variables de entorno del backend:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***CONFIGURADO***' : 'NO CONFIGURADO');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('SECRET:', process.env.SECRET ? '***CONFIGURADO***' : 'NO CONFIGURADO');
console.log('PORT:', process.env.PORT);
