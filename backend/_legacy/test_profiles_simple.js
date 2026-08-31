import SecurityService from './service/security_service.js';

async function testProfilesFlow() {
    console.log('🧪 Probando flujo de perfiles (sin DB)...\n');
    
    try {
        // 1. Crear instancia de SecurityService
        const security = new SecurityService();
        
        // 2. Simular carga de perfiles (manualmente)
        console.log('📋 Cargando perfiles de usuario en memoria...');
        
        // Simular usuarios y sus perfiles
        security.userProfiles.set('admin', new Set(['admin', 'user']));
        security.userProfiles.set('miguel', new Set(['admin']));
        security.userProfiles.set('guest', new Set(['user']));
        
        // 3. Probar verificación de perfiles
        console.log('\n✅ Verificando perfiles asignados:');
        console.log('  admin tiene admin:', security.hasUserProfile('admin', 'admin'));
        console.log('  admin tiene user:', security.hasUserProfile('admin', 'user'));
        console.log('  miguel tiene admin:', security.hasUserProfile('miguel', 'admin'));
        console.log('  guest tiene admin:', security.hasUserProfile('guest', 'admin'));
        
        // 4. Simular permisos
        console.log('\n📋 Cargando permisos...');
        security.permissions.set('security::person::createperson::admin', {
            sub_system: 'Security',
            class: 'Person',
            method: 'createPerson',
            profile: 'admin'
        });
        
        // 5. Probar validación completa como lo haría el Dispatcher
        console.log('\n🔍 Simulando validación del Dispatcher:');
        
        const testScenarios = [
            { userId: 'admin', profile: 'admin', method: 'createPerson' },
            { userId: 'miguel', profile: 'admin', method: 'createPerson' },
            { userId: 'guest', profile: 'admin', method: 'createPerson' },
        ];
        
        for (const scenario of testScenarios) {
            console.log(`\n  📝 Usuario: ${scenario.userId}, Perfil requerido: ${scenario.profile}`);
            
            // Verificar si usuario tiene el perfil
            const hasProfile = security.hasUserProfile(scenario.userId, scenario.profile);
            console.log(`    ✅ Tiene perfil: ${hasProfile}`);
            
            if (!hasProfile) {
                console.log(`    ❌ ACCESO DENEGADO: Usuario no tiene el perfil requerido`);
                continue;
            }
            
            // Verificar si existe el permiso
            const permission = {
                sub_system: 'Security',
                class: 'Person',
                method: scenario.method,
                profile: scenario.profile
            };
            
            const hasPermission = security.hasPermission(permission);
            console.log(`    ✅ Permiso existe: ${hasPermission}`);
            
            if (hasPermission) {
                console.log(`    🚀 ACCESO AUTORIZADO: Método puede ejecutarse`);
            } else {
                console.log(`    ❌ ACCESO DENEGADO: Permiso no encontrado`);
            }
        }
        
        // 6. Mostrar estado final
        console.log('\n🗺️ Estado final de perfiles en memoria:');
        for (const [userId, profiles] of security.userProfiles) {
            console.log(`  ${userId}: [${Array.from(profiles).join(', ')}]`);
        }
        
        console.log('\n✅ Prueba completada exitosamente');
        
    } catch (error) {
        console.error('💥 Error en la prueba:', error.message);
    }
}

// Ejecutar la prueba
testProfilesFlow();
