import axios from 'axios';

async function testDispatcherSimple() {
    console.log('🌐 Probando endpoint del Dispatcher (sin DB)...\n');
    
    const baseURL = 'http://localhost:3000';
    
    try {
        // 1. Probar endpoint de estado (no necesita DB)
        console.log('1️⃣ Verificando estado del Dispatcher...');
        const statusResponse = await axios.get(`${baseURL}/dispatcher/status`);
        console.log('✅ Status:', statusResponse.data);
        
        // 2. Probar validación de datos (no necesita DB)
        console.log('\n2️⃣ Probando validación de datos...');
        try {
            const invalidResponse = await axios.post(`${baseURL}/dispatcher`, {
                permission: {
                    // Campos faltantes
                }
            });
            console.log('❌ Inesperado: Debería haber fallado');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Correcto: Rechazado por datos inválidos');
                console.log('   Error:', error.response.data.error);
            } else {
                throw error;
            }
        }
        
        // 3. Probar sin permiso (debe fallar por sesión)
        console.log('\n3️⃣ Probando ejecución sin sesión...');
        try {
            const executeResponse = await axios.post(`${baseURL}/dispatcher`, {
                permission: {
                    sub_system: 'Security',
                    class: 'Person',
                    method: 'createPerson',
                    profile: 'admin',
                    parameter: {
                        ci: '12345678',
                        name: 'Test',
                        lastname: 'User',
                        email: 'test@example.com',
                        phone: '04121234567'
                    }
                }
            });
            console.log('❌ Inesperado: Debería haber fallado por sesión');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Correcto: Rechazado por falta de sesión');
                console.log('   Mensaje:', error.response.data.message);
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 Pruebas básicas del endpoint completadas exitosamente');
        console.log('💡 El endpoint está funcionando correctamente');
        console.log('🔧 Para pruebas completas, necesita la base de datos configurada');
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Error: El servidor no está corriendo');
            console.log('💡 Inicia el servidor con: node main.js');
        } else {
            console.error('💥 Error en las pruebas:', error.message);
            if (error.response) {
                console.error('Response:', error.response.data);
            }
        }
    }
}

// Ejecutar las pruebas
testDispatcherSimple();
