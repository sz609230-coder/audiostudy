export interface MicrophoneErrorInfo {
  code: 'unsupported' | 'denied' | 'not_found' | 'in_use' | 'interrupted' | 'unknown';
  title: string;
  message: string;
  instructions: string[];
}

export function isRecordingSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function' &&
    typeof MediaRecorder !== 'undefined'
  );
}

export function explainMicrophoneError(error: unknown): MicrophoneErrorInfo {
  const errName = error instanceof DOMException ? error.name : error instanceof Error ? error.name : '';

  if (!isRecordingSupported()) {
    return {
      code: 'unsupported',
      title: 'Grabación no compatible',
      message: 'Este navegador no admite grabación de audio mediante MediaRecorder o micrófono web.',
      instructions: [
        'Abre AudioStudy en Google Chrome, Edge o Safari moderno.',
        'Asegúrate de acceder mediante HTTPS o localhost.',
      ],
    };
  }

  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return {
      code: 'denied',
      title: 'Permiso de micrófono denegado',
      message: 'AudioStudy necesita acceso al micrófono para grabar tu voz.',
      instructions: [
        'Toca el icono de candado o configuración junto a la dirección web en la barra superior.',
        'Busca el permiso "Micrófono" y cámbialo a "Permitir".',
        'En Android, también verifica Ajustes > Aplicaciones > Navegador > Permisos > Micrófono.',
        'Recarga la pestaña o pulsa "Intentar de nuevo".',
      ],
    };
  }

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return {
      code: 'not_found',
      title: 'No se encontró un micrófono',
      message: 'No detectamos ningún micrófono conectado o disponible en este dispositivo.',
      instructions: [
        'Conecta unos auriculares con micrófono o verifica el micrófono integrado del teléfono.',
      ],
    };
  }

  if (errName === 'NotReadableError' || errName === 'TrackStartError' || errName === 'AbortError') {
    return {
      code: 'in_use',
      title: 'Micrófono ocupado por otra aplicación',
      message: 'Otra aplicación, llamada o asistente de voz está utilizando el micrófono en este momento.',
      instructions: [
        'Cierra llamadas activas u otras grabadoras abiertas en segundo plano.',
        'Espera unos segundos y vuelve a intentar.',
      ],
    };
  }

  return {
    code: 'unknown',
    title: 'Error al acceder al micrófono',
    message: error instanceof Error ? error.message : 'Ocurrió un problema inesperado con el micrófono.',
    instructions: ['Comprueba los permisos del navegador y vuelve a intentarlo.'],
  };
}

export async function requestMicrophoneStream(): Promise<MediaStream> {
  if (!isRecordingSupported()) {
    throw new Error('Navegador incompatible con grabación de audio.');
  }
  return navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
}
