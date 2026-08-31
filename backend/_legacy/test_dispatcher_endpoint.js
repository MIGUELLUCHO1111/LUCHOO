import axios from 'axios';

async function testDispatcherEndpoint() {
    console.log('🌐 Probando endpoint público del Dispatcher...\n');
    
    const baseURL = 'http://localhost:3000';
    
    try {
        // 1. Probar endpoint de estado
        console.log('1️⃣ Verificando estado del Dispatcher...');
        const statusResponse = await axios.get(`${baseURL}/dispatcher/status`);
        console.log('✅ Status:', statusResponse.data);
        
        // 2. Probar verificación de permisos
        console.log('\n2️⃣ Verificando permisos...');
        const permissionCheck = await axios.post(`${baseURL}/dispatcher/check-permission`, {
            permission: {
                sub_system: 'Security',
                class: 'Person',
                method: 'createPerson',
                profile: 'admin'
            }
        });
        console.log('✅ Permission check:', permissionCheck.data);
        
        // 3. Probar ejecución sin sesión (debe fallar)
        console.log('\n3️⃣ Probando ejecución sin sesión (debe fallar)...');
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
            console.log('❌ Inesperado: La ejecución debería haber fallado');
        } catch (error) {
            if (error.response && error.response.status === 401) {
                console.log('✅ Correcto: Rechazado por falta de sesión');
                console.log('   Mensaje:', error.response.data.message);
            } else {
                throw error;
            }
        }
        
        // 4. Probar con datos inválidos
        console.log('\n4️⃣ Probando con datos inválidos...');
        try {
            const invalidResponse = await axios.post(`${baseURL}/dispatcher`, {
                permission: {
                    // Campos faltantes
                }
            });
            console.log('❌ Inesperado: Debería haber fallado por datos inválidos');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                console.log('✅ Correcto: Rechazado por datos inválidos');
                console.log('   Error:', error.response.data.error);
            } else {
                throw error;
            }
        }
        
        console.log('\n🎉 Pruebas del endpoint completadas exitosamente');
        
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Error: El servidor no está corriendo');
            console.log('💡 Inicia el servidor con: npm run dev');
        } else {
            console.error('💥 Error en las pruebas:', error.message);
            if (error.response) {
                console.error('Response:', error.response.data);
            }
        }
    }
}

// Ejecutar las pruebas
testDispatcherEndpoint();
