import { useState, useEffect } from 'react'; 
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ArrowLeft } from 'lucide-react';

import { Field, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { NotificationToast, AlertMessage } from '@/components';

import { resetPasswordSchema } from '@/auth/schemasAuth';
import { useAuth } from '@/context';

export const ResetPasswordLayout = () => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '' });
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const token = searchParams.get('token');


  useEffect(() => {
    if (!token) {
      const timer = setTimeout(() => {
        navigate('/login');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [token, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data) => {
    try {
      await resetPassword({
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      setToast({
        message: 'Contraseña actualizada correctamente',
        type: 'success',
      });

      setTimeout(() => setIsSuccess(true), 1200);
    } catch (err) {
      setToast({
        message: err.message || 'Error al intentar actualizar la contraseña',
        type: 'error',
      });
    }
  };

  if (!token) {
    return (
      <AlertMessage
        type='error'
        title='Acceso no autorizado'
        message='El enlace para restablecer la contraseña es inválido o ha expirado. Serás redirigido al inicio de sesión.'
        buttonText='Ir al Login ahora'
        onConfirm={() => navigate('/login')}
      />
    );
  }

  if (isSuccess) {
    return (
      <AlertMessage
        type='success'
        title='¡Todo listo!'
        message='Tu contraseña ha sido actualizada con éxito. Ahora puedes volver a ingresar a tu cuenta con tus nuevas credenciales.'
        buttonText='Ir al inicio de sesión'
        onConfirm={() => navigate('/login')}
      />
    );
  }

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: 'easeOut', staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0 },
  };

  return (
    <>
      <NotificationToast
        message={toast.message}
        type={toast.type}
        onClose={() => setToast({ message: '', type: '' })}
      />

      <motion.div
        className='auth-container w-full max-w-[360px] rounded-[16px] p-5 shadow-xl border border-white/5 bg-white/80 dark:bg-black/40 backdrop-blur-xl'
        initial='hidden'
        animate='visible'
        variants={containerVariants}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <FieldSet>
            <motion.div className='text-center mb-4' variants={itemVariants}>
              <h1 className='text-xl font-extrabold tracking-tight'>
                Restablecer Contraseña
              </h1>
              <p className='text-muted-foreground text-[11px] mt-0.5 font-medium opacity-80'>
                Configura tu nueva contraseña
              </p>
            </motion.div>

            <FieldGroup className='space-y-2'>
              {[
                {
                  id: 'password',
                  label: 'Nueva Contraseña',
                },
                {
                  id: 'confirmPassword',
                  label: 'Confirmar Contraseña',
                },
              ].map((f) => (
                <motion.div key={f.id} variants={itemVariants}>
                  <Field>
                    <FieldLabel
                      htmlFor={f.id}
                      className='text-[11px] font-semibold mb-1 block opacity-90'
                    >
                      {f.label}
                    </FieldLabel>
                    <div className='relative group'>
                      <div className='absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none'>
                        <Lock className='h-3.5 w-3.5' />
                      </div>
                      <Input
                        id={f.id}
                        type='password'
                        className={`auth-input pl-9 h-8.5 text-sm rounded-lg relative z-0 ${errors[f.id] ? 'border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.1)]' : ''}`}
                        placeholder='••••••••'
                        {...register(f.id)}
                      />
                    </div>
                    <AnimatePresence mode='wait'>
                      {errors[f.id] && (
                        <motion.p
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className='text-[10px] text-red-500 mt-1 ml-1 font-medium overflow-hidden'
                        >
                          {errors[f.id].message}
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </Field>
                </motion.div>
              ))}
            </FieldGroup>
          </FieldSet>

          <motion.div
            className='mt-5 flex flex-col gap-2'
            variants={itemVariants}
          >
            <Button
              type='submit'
              disabled={isSubmitting}
              className='auth-submit-btn w-full h-9.5 rounded-lg font-bold text-white uppercase tracking-wider text-[10px] cursor-pointer shadow-md'
            >
              {isSubmitting ? 'Actualizando...' : 'Actualizar Contraseña'}
            </Button>

            <Button
              variant='ghost'
              type='button'
              onClick={() => navigate('/login')}
              className='text-[10px] h-7 font-semibold text-muted-foreground hover:text-foreground transition-all flex items-center justify-center gap-2 group cursor-pointer'
            >
              <ArrowLeft
                size={12}
                className='group-hover:-translate-x-1 transition-transform'
              />
              Volver al Login
            </Button>
          </motion.div>
        </form>
      </motion.div>
    </>
  );
};