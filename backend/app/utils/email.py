import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
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
