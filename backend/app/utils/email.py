import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

from starlette.concurrency import run_in_threadpool


def _send_credentials_email_sync(email_to: str, code: str, token: str):
    """Sync implementation of email sending"""
    if not settings.SMTP_HOST or not settings.EMAIL_FROM_ADDRESS:
        logger.warning("SMTP configuration is incomplete. Skipping email sending.")
        return

    # Professional HTML Template
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Canal de Denuncias Anónimo</h2>
            <p>Has enviado una denuncia correctamente. A continuación, se detallan tus credenciales para consultar el estado de la misma en el futuro.</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Código de Seguimiento:</p>
                <p style="margin: 5px 0 15px 0; font-family: monospace; font-size: 20px; font-weight: bold; color: #1e3a8a;">{code}</p>
                
                <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Clave de Seguridad:</p>
                <p style="margin: 5px 0 0 0; font-family: monospace; font-size: 20px; font-weight: bold; color: #7c3aed;">{token}</p>
            </div>
            
            <p style="color: #dc2626; font-weight: bold;">IMPORTANTE:</p>
            <p>Guarda estos códigos en un lugar seguro. No podrás recuperarlos si los pierdes.</p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 12px; color: #9ca3af;">
                Este es un mensaje automático generado por el Canal de Denuncias Anónimo. 
                De acuerdo con nuestra política de privacidad, <strong>tu dirección de correo electrónico no ha sido almacenada</strong> 
                en nuestra base de datos y este mensaje ha sido enviado por una única vez.
            </p>
        </div>
    </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = "Credenciales de Seguimiento - Canal de Denuncias"
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
    message["To"] = email_to

    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            
            if settings.SMTP_USER and settings.SMTP_PASS:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            
            server.send_message(message)
            logger.info(f"Credentials email sent successfully to {email_to[:3]}...@{email_to.split('@')[-1]}")
    except Exception as e:
        logger.error(f"Error sending credentials email: {str(e)}", exc_info=True)

async def send_credentials_email(email_to: str, code: str, token: str):
    """
    Async wrapper for sending credentials email.
    """
    await run_in_threadpool(_send_credentials_email_sync, email_to, code, token)

def _send_password_reset_otp_sync(email_to: str, otp: str):
    """Sync implementation of OTP email sending"""
    if not settings.SMTP_HOST or not settings.EMAIL_FROM_ADDRESS:
        logger.warning("SMTP configuration is incomplete. Skipping email sending.")
        return

    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
            <h2 style="color: #1e3a8a;">Cambio de Contraseña</h2>
            <p>Has solicitado cambiar tu contraseña. Utiliza el siguiente código para verificar tu identidad:</p>
            
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                <p style="margin: 0; font-size: 14px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Código de Verificación:</p>
                <p style="margin: 5px 0 0 0; font-family: monospace; font-size: 32px; font-weight: bold; color: #1e3a8a; letter-spacing: 5px;">{otp}</p>
            </div>
            
            <p>Este código expirará en 10 minutos.</p>
            <p>Si no has solicitado este cambio, ignora este correo.</p>
            
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            
            <p style="font-size: 12px; color: #9ca3af;">
                Web RRHH - Seguridad
            </p>
        </div>
    </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = "Código de Verificación - Cambio de Contraseña"
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
    message["To"] = email_to

    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            
            if settings.SMTP_USER and settings.SMTP_PASS:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            
            server.send_message(message)
            logger.info(f"OTP email sent successfully to {email_to}")
    except Exception as e:
        logger.error(f"Error sending OTP email: {str(e)}", exc_info=True)

async def send_password_reset_otp(email_to: str, otp: str):
    """
    Async wrapper for sending OTP email.
    """
    await run_in_threadpool(_send_password_reset_otp_sync, email_to, otp)

def _send_complaint_notification_email_sync(email_to: str, complaint_code: str, complaint_title: str):
    """Sync implementation for notifying admins about a new complaint"""
    if not settings.SMTP_HOST or not settings.EMAIL_FROM_ADDRESS:
        return

    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 16px; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #3C65AB; color: #ffffff; width: 60px; height: 60px; line-height: 60px; border-radius: 12px; font-size: 30px; margin: 0 auto; font-weight: bold;">!</div>
                <h2 style="color: #111827; margin-top: 20px; font-size: 24px; font-weight: 800;">Nueva Denuncia Recibida</h2>
                <p style="color: #6b7280; font-size: 16px;">Se ha registrado una nueva entrada en el Canal Ético del sistema.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #3C65AB;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Título de la Denuncia:</p>
                <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #111827;">{complaint_title}</p>
                
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Código de Referencia:</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; color: #3C65AB;">{complaint_code}</p>
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="{settings.CORS_ORIGINS.split(',')[0]}/admin/complaints" style="background-color: #3C65AB; color: #ffffff; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; transition: background-color 0.2s;">Gestionar Denuncia</a>
            </div>
            
            <p style="font-size: 14px; color: #4b5563; text-align: center;">
                Puedes acceder al panel de administración para revisar los detalles y comenzar la investigación.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Este es un aviso automático enviado a los gestores del Canal Ético de Web RRHH.
            </p>
        </div>
    </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = f"ALERTA: Nueva Denuncia Registrada ({complaint_code})"
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
    message["To"] = email_to

    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASS:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(message)
            logger.info(f"Complaint notification email sent successfully to {email_to}")
    except Exception as e:
        logger.error(f"Error sending complaint notification: {str(e)}", exc_info=True)

async def send_complaint_notification(email_to: str, code: str, title: str):
    """Async wrapper for sending complaint notification email"""
    await run_in_threadpool(_send_complaint_notification_email_sync, email_to, code, title)


def _send_news_notification_email_sync(email_to: str, news_title: str, news_summary: str, news_id: str):
    """Sync implementation for notifying users about new published news"""
    if not settings.SMTP_HOST or not settings.EMAIL_FROM_ADDRESS:
        return

    # Try to get the first CORS origin as base URL for the news link
    base_url = "http://localhost:4200"
    if settings.CORS_ORIGINS:
        origins = settings.CORS_ORIGINS.split(',')
        if origins:
            base_url = origins[0].strip()

    news_link = f"{base_url}/news/{news_id}"

    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <!-- Header -->
            <div style="background-color: #3C65AB; padding: 30px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Nueva Noticia Publicada</h2>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px;">
                <h3 style="color: #111827; margin: 0 0 15px 0; font-size: 20px; font-weight: 700; line-height: 1.3;">{news_title}</h3>
                
                <p style="color: #4b5563; font-size: 16px; margin-bottom: 25px; line-height: 1.6;">
                    {news_summary}
                </p>
                
                <div style="text-align: center; margin-top: 35px;">
                    <a href="{news_link}" style="background-color: #3C65AB; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; transition: all 0.2s;">Leer Noticia Completa</a>
                </div>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #edf2f7;">
                <p style="font-size: 12px; color: #9ca3af; margin: 0;">
                    Has recibido este correo porque tienes activadas las notificaciones de noticias en tu perfil de Web RRHH.
                </p>
            </div>
        </div>
    </body>
    </html>
    """

    message = MIMEMultipart("alternative")
    message["Subject"] = f"Nueva Noticia: {news_title}"
    message["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
    message["To"] = email_to

    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASS:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
            server.send_message(message)
            logger.info(f"News notification email sent successfully to {email_to}")
    except Exception as e:
        logger.error(f"Error sending news notification to {email_to}: {str(e)}", exc_info=True)

async def send_news_notification(email_to: str, title: str, summary: str, news_id: str):
    """Async wrapper for sending news notification email"""
    await run_in_threadpool(_send_news_notification_email_sync, email_to, title, summary, news_id)
