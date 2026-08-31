import Security from './src/security/security.js';
import Config from './config/config.js';

async function testExecuteAuthorized() {
  console.log('🧪 Probando executeAuthorized...\n');

  try {
    // 1. Inicializar el SecurityService
    const security = new Security();
    await security.syncPermissions();

    // 2. Crear un permiso de prueba (debe existir en permission.csv)
    const testPermission = {
      sub_system: 'Security',
      class: 'Person',
      method: 'createPerson',
      profile: 'admin',
      parameter: {
        ci: '12345678',
        name: 'Test',
        lastname: 'User',
        email: 'test@example.com',
        phone: '04121234567',
      },
    };

    console.log('📋 Permiso de prueba:', testPermission);

    // 3. Verificar que el permiso exista
    const hasPermission = security.hasPermission(testPermission);
    console.log('✅ Permiso existe:', hasPermission);

    if (!hasPermission) {
      console.log('❌ El permiso no existe en permission.csv');
      return;
    }

    // 4. Ejecutar el método autorizado
    console.log('\n🚀 Ejecutando método autorizado...');
    const result = await security.executeAuthorized(testPermission);

    console.log('\n📊 Resultado:', JSON.stringify(result, null, 2));

    if (result.statusCode === 200) {
      console.log('✅ Método ejecutado exitosamente');
    } else {
      console.log('❌ Error en la ejecución:', result.error);
    }
  } catch (error) {
    console.error('💥 Error en la prueba:', error.message);
  }
}

// Ejecutar la prueba
testExecuteAuthorized();
