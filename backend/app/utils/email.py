import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import settings

logger = logging.getLogger(__name__)

from starlette.concurrency import run_in_threadpool
from fastapi import Request


def get_base_url(request: Request | None = None) -> str:
    """Determine the base URL for the frontend, prioritizing explicit config,
    then request headers, then defaulting to localhost."""
    # 1. Highest priority: Manual override in .env
    if settings.FRONTEND_URL:
        return settings.FRONTEND_URL.rstrip('/')
        
    # 2. Dynamic detection from request (useful for dev or multi-tenant)
    if request:
        scheme = request.headers.get("X-Forwarded-Proto", request.url.scheme)
        host = request.headers.get("Host", request.url.netloc)
        
        # Clean up standard ports for cleaner URLs
        if (scheme == "https" and host.endswith(":443")) or (scheme == "http" and host.endswith(":80")):
            host = host.rsplit(":", 1)[0]
            
        return f"{scheme}://{host}"
        
    # 3. Last resort fallback
    return "http://localhost:8080"
def _send_smtp_email(email_to: str, subject: str, html_content: str, service: str):
    """Generic helper to send SMTP emails using service-specific or default settings"""
    smtp_settings = settings.get_smtp_settings(service)
    
    if not smtp_settings["host"] or not smtp_settings["from_address"]:
        logger.warning(f"SMTP configuration for {service} is incomplete. Skipping email sending.")
        return

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"{smtp_settings['from_name']} <{smtp_settings['from_address']}>"
    message["To"] = email_to

    message.attach(MIMEText(html_content, "html"))

    try:
        with smtplib.SMTP(smtp_settings["host"], smtp_settings["port"]) as server:
            if smtp_settings["tls"]:
                server.starttls()
            
            if smtp_settings["user"] and smtp_settings["password"]:
                server.login(smtp_settings["user"], smtp_settings["password"])
            
            server.send_message(message)
            logger.info(f"{service.capitalize()} email sent successfully to {email_to}")
    except Exception as e:
        logger.error(f"Error sending {service} email to {email_to}: {str(e)}", exc_info=True)

def _send_credentials_email_sync(email_to: str, code: str, token: str, request: Request | None = None):
    """Sync implementation of email sending for complaints credentials with Ley 2/2023 compliance"""
    base_url = get_base_url(request)
    tracking_url = f"{base_url}/complaint/status/{code}?token={token}"
    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 20px; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #3C65AB; color: #ffffff; width: 64px; height: 64px; line-height: 64px; border-radius: 16px; font-size: 32px; margin: 0 auto; font-weight: bold; display: inline-block;">✓</div>
                <h2 style="color: #111827; margin-top: 20px; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Confirmación de Recepción</h2>
                <p style="color: #6b7280; font-size: 16px;">Canal Interno de Información</p>
            </div>

            <p style="font-size: 16px;">Hola:</p>
            <p style="font-size: 16px;">Le confirmamos que hemos recibido su comunicación correctamente. Este mensaje sirve como <strong>acuse de recibo oficial</strong> dentro del plazo legal de 7 días establecido por la Ley 2/2023.</p>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 16px; margin: 30px 0; border: 1px solid #e5e7eb;">
                <h3 style="margin: 0 0 20px 0; font-size: 14px; color: #374151; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em; text-align: center;">Información importante para usted</h3>
                
                <div style="margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Su código de seguimiento:</p>
                    <p style="margin: 5px 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 800; color: #3C65AB; letter-spacing: 1px;">{code}</p>
                </div>
                
                <div>
                    <p style="margin: 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: bold;">Clave de Seguridad:</p>
                    <p style="margin: 5px 0; font-family: 'Courier New', monospace; font-size: 22px; font-weight: 800; color: #7c3aed; letter-spacing: 1px;">{token}</p>
                </div>
                
                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                    <a href="{tracking_url}" style="background-color: #3C65AB; color: #ffffff; padding: 14px 25px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Consultar mi Denuncia</a>
                </div>

                <p style="margin-top: 20px; font-size: 13px; color: #4b5563; font-style: italic;">
                    Use este botón o el código anterior para acceder al canal y revisar actualizaciones o responder a preguntas. <strong>No pierda estos datos</strong>, ya que son la única forma de acceder.
                </p>
            </div>

            <div style="space-y: 15px;">
                <p style="font-size: 14px; margin-bottom: 12px;">Le garantizamos que su identidad está protegida y que la ley prohíbe cualquier tipo de represalia contra usted por haber informado de buena fe.</p>
                <p style="font-size: 14px; margin-bottom: 12px;">Ahora iniciaremos una fase de análisis previo. Le informaremos sobre el estado de la investigación en un plazo máximo de 3 meses (salvo que la complejidad del caso requiera una prórroga).</p>
                <p style="font-size: 14px; margin-bottom: 12px;">Sus datos se tratarán exclusivamente para gestionar esta comunicación conforme a la normativa vigente de Protección de Datos.</p>
            </div>

            <p style="margin-top: 30px; font-size: 15px; font-weight: 600;">Gracias por contribuir al cumplimiento y la ética en nuestra organización.</p>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #f3f4f6; text-align: center;">
                <p style="margin: 0; font-size: 14px; font-weight: 700; color: #111827;">Atentamente,</p>
                <p style="margin: 5px 0 0 0; font-size: 14px; color: #6b7280;">Gestor del Sistema Interno de Información</p>
            </div>
            
            <div style="margin-top: 30px; background-color: #fffbeb; border: 1px solid #fef3c7; padding: 15px; border-radius: 12px;">
                <p style="margin: 0; font-size: 11px; color: #92400e; line-height: 1.4;">
                    <strong>Nota sobre Privacidad:</strong> Su dirección de correo electrónico no ha sido almacenada en nuestra base de datos permanente. Este mensaje ha sido enviado mediante un proceso volátil único.
                </p>
            </div>
        </div>
    </body>
    </html>
    """
    _send_smtp_email(email_to, f"Confirmación de recepción - Canal de Información (Ref: {code})", html_content, "complaint")

async def send_credentials_email(email_to: str, code: str, token: str, request: Request | None = None):
    """Async wrapper for sending credentials email."""
    await run_in_threadpool(_send_credentials_email_sync, email_to, code, token, request)

def _send_password_reset_otp_sync(email_to: str, otp: str):
    """Sync implementation of OTP email sending"""
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
    # Password reset uses default SMTP (or could be auth if we add it)
    _send_smtp_email(email_to, "Código de Verificación - Cambio de Contraseña", html_content, "auth")

async def send_password_reset_otp(email_to: str, otp: str):
    """Async wrapper for sending OTP email."""
    await run_in_threadpool(_send_password_reset_otp_sync, email_to, otp)

def _send_complaint_notification_email_sync(email_to: str, complaint_code: str, complaint_title: str, request: Request | None = None):
    """Sync implementation for notifying admins about a new complaint"""
    base_url = get_base_url(request)

    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 16px; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #3C65AB; color: #ffffff; width: 60px; height: 60px; line-height: 60px; border-radius: 12px; font-size: 30px; margin: 0 auto; font-weight: bold;">!</div>
                <h2 style="color: #111827; margin-top: 20px; font-size: 24px; font-weight: 800;">Nueva Denuncia Recibida</h2>
                <p style="color: #6b7280; font-size: 16px;">Se ha registrado una nueva entrada en el Canal de Denuncias del sistema.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #3C65AB;">
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Título de la Denuncia:</p>
                <p style="margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #111827;">{complaint_title}</p>
                
                <p style="margin: 0 0 5px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Código de Referencia:</p>
                <p style="margin: 0; font-family: 'Courier New', monospace; font-size: 16px; font-weight: bold; color: #3C65AB;">{complaint_code}</p>
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="{base_url}/admin/complaints" style="background-color: #3C65AB; color: #ffffff; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block; transition: background-color 0.2s;">Gestionar Denuncia</a>
            </div>
            
            <p style="font-size: 14px; color: #4b5563; text-align: center;">
                Puedes acceder al panel de administración para revisar los detalles y comenzar la investigación.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;">
            
            <p style="font-size: 12px; color: #9ca3af; text-align: center;">
                Este es un aviso automático enviado a los gestores del Canal de Denuncias de Web RRHH.
            </p>
        </div>
    </body>
    </html>
    """
    _send_smtp_email(email_to, f"ALERTA: Nueva Denuncia Registrada ({complaint_code})", html_content, "complaint")

async def send_complaint_notification(email_to: str, code: str, title: str, request: Request | None = None):
    """Async wrapper for sending complaint notification email"""
    await run_in_threadpool(_send_complaint_notification_email_sync, email_to, code, title, request)

def _send_complaint_comment_notification_email_sync(email_to: str, complaint_code: str, complaint_title: str, author_name: str, request: Request | None = None):
    """Sync implementation for notifying admins about a new comment/response in a complaint"""
    base_url = get_base_url(request)

    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 16px; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <div style="text-align: center; margin-bottom: 30px;">
                <div style="background-color: #7c3aed; color: #ffffff; width: 60px; height: 60px; line-height: 60px; border-radius: 12px; font-size: 30px; margin: 0 auto; font-weight: bold;">💬</div>
                <h2 style="color: #111827; margin-top: 20px; font-size: 24px; font-weight: 800;">Nuevo Comentario Recibido</h2>
                <p style="color: #6b7280; font-size: 16px;">Se ha añadido una nueva respuesta en una denuncia activa.</p>
            </div>
            
            <div style="background-color: #f3f4f6; padding: 25px; border-radius: 12px; margin: 30px 0; border-left: 4px solid #7c3aed;">
                <p style="margin: 0 0 10px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Denuncia:</p>
                <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: 700; color: #111827;">{complaint_title}</p>
                <p style="margin: 0 0 20px 0; font-family: 'Courier New', monospace; font-size: 13px; color: #3C65AB; font-weight: bold;">Ref: {complaint_code}</p>
                
                <p style="margin: 0 0 5px 0; font-size: 11px; color: #6b7280; text-transform: uppercase; font-weight: 800; letter-spacing: 0.1em;">Enviado por:</p>
                <p style="margin: 0; font-size: 14px; font-weight: bold; color: #4b5563;">{author_name}</p>
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
                <a href="{base_url}/admin/complaints" style="background-color: #3C65AB; color: #ffffff; padding: 14px 30px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Ver Comentario</a>
            </div>
            
            <p style="font-size: 13px; color: #6b7280; text-align: center;">
                Recuerde que el plazo legal para la resolución continúa en curso. Por favor, revise la información a la mayor brevedad.
            </p>
            
            <hr style="border: 0; border-top: 1px solid #edf2f7; margin: 30px 0;">
            
            <p style="font-size: 11px; color: #9ca3af; text-align: center; font-style: italic;">
                Este es un aviso automático de seguridad del Canal de Denuncias.
            </p>
        </div>
    </body>
    </html>
    """
    _send_smtp_email(email_to, f"Nuevo comentario en denuncia {complaint_code}", html_content, "complaint")

async def send_complaint_comment_notification(email_to: str, code: str, title: str, author_name: str, request: Request | None = None):
    """Async wrapper for sending complaint comment notification email"""
    await run_in_threadpool(_send_complaint_comment_notification_email_sync, email_to, code, title, author_name, request)

def _send_news_notification_email_sync(email_to: str, news_title: str, news_summary: str, news_id: str, request: Request | None = None):
    """Sync implementation for notifying users about new published news"""
    base_url = get_base_url(request)

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
    _send_smtp_email(email_to, f"Nueva Noticia: {news_title}", html_content, "news")

async def send_news_notification(email_to: str, title: str, summary: str, news_id: str, request: Request | None = None):
    """Async wrapper for sending news notification email"""
    await run_in_threadpool(_send_news_notification_email_sync, email_to, title, summary, news_id, request)

def _send_vacation_notification_email_sync(email_to: str, requester_name: str, start_date: str, end_date: str, days: float, type: str, request: Request | None = None):
    """Sync implementation for notifying managers/RRHH about a new vacation request"""
    base_url = get_base_url(request)

    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <div style="background-color: #3C65AB; padding: 30px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">Nueva Solicitud de Vacaciones</h2>
            </div>
            
            <div style="padding: 40px;">
                <p style="font-size: 16px; color: #111827;"><strong>{requester_name}</strong> ha enviado una nueva solicitud de ausencia.</p>
                
                <div style="background-color: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #e5e7eb;">
                    <p style="margin: 5px 0;"><strong>Tipo:</strong> {type}</p>
                    <p style="margin: 5px 0;"><strong>Desde:</strong> {start_date}</p>
                    <p style="margin: 5px 0;"><strong>Hasta:</strong> {end_date or start_date}</p>
                    <p style="margin: 5px 0;"><strong>Total días:</strong> {days}</p>
                </div>
                
                <div style="text-align: center; margin-top: 35px;">
                    <a href="{base_url}/admin/vacations" style="background-color: #3C65AB; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Revisar Solicitud</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    """
    _send_smtp_email(email_to, f"Nueva Solicitud de Vacaciones - {requester_name}", html_content, "vacation")

async def send_vacation_notification(email_to: str, requester_name: str, start_date: str, end_date: str, days: float, type: str, request: Request | None = None):
    """Async wrapper for sending vacation notification email"""
    await run_in_threadpool(_send_vacation_notification_email_sync, email_to, requester_name, start_date, end_date, days, type, request)

def _send_vacation_status_email_sync(email_to: str, status: str, manager_name: str, reason: str | None = None):
    """Sync implementation for notifying user about their vacation request status"""
    status_colors = {
        "Aprobada": "#10b981",
        "Rechazada": "#ef4444",
        "Pendiente": "#f59e0b"
    }
    color = status_colors.get(status, "#3C65AB")

    html_content = f"""
    <html>
    <body style="font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f3f4f6; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e5e7eb;">
            <div style="background-color: {color}; padding: 30px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800;">Estado de Solicitud: {status}</h2>
            </div>
            
            <div style="padding: 40px;">
                <p style="font-size: 16px; color: #111827;">Tu solicitud de vacaciones ha sido gestionada por <strong>{manager_name}</strong>.</p>
                
                <p style="font-size: 18px; font-weight: bold; color: {color}; margin: 20px 0;">Estado Actual: {status}</p>
                
                {f'<div style="background-color: #fef2f2; padding: 15px; border-radius: 8px; border-left: 4px solid #ef4444; margin: 20px 0;"><p style="margin: 0; color: #991b1b;"><strong>Motivo:</strong> {reason}</p></div>' if reason else ''}
                
                <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">Puedes consultar los detalles en tu panel de empleado.</p>
            </div>
        </div>
    </body>
    </html>
    """
    _send_smtp_email(email_to, f"Actualización de Solicitud de Vacaciones: {status}", html_content, "vacation")

async def send_vacation_status_notification(email_to: str, status: str, manager_name: str, reason: str | None = None):
    """Async wrapper for sending vacation status update email"""
    await run_in_threadpool(_send_vacation_status_email_sync, email_to, status, manager_name, reason)
