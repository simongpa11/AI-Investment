import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Documentación — AI Investment',
    description: 'Guía de uso y funcionamiento del sistema de detección estructural',
};

export default function DocsPage() {
    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px', paddingBottom: 100 }}>
            <div className="dashboard-header" style={{ marginBottom: 40 }}>
                <h1 className="dashboard-title">Documentación del Sistema</h1>
                <p className="dashboard-subtitle">
                    Cómo funciona el motor de detección de cambio estructural temprano
                </p>
            </div>

            <article style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.95rem' }}>

                <section style={{ marginBottom: 48 }}>
                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: 16 }}>
                        1. Ciclo de Escaneo (Schedule)
                    </h2>
                    <p style={{ marginBottom: 16 }}>
                        El sistema ejecuta 3 escaneos automáticos diarios (hora CET) para abarcar el ciclo global:
                    </p>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
                        <div style={{ marginBottom: 16 }}>
                            <strong style={{ color: 'var(--accent-amber)' }}>🌅 08:00 CET — Morning Scan</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                                Escáner estructural rápido. Cubre el cierre de Asia e inicio de Europa para detectar gaps overnight y rotaciones tempranas.
                            </p>
                        </div>
                        <div style={{ marginBottom: 16 }}>
                            <strong style={{ color: 'var(--accent-emerald)' }}>🌆 18:45 CET — Afternoon Scan</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                                Estructural + Narrativa IA. Cubre el cierre de Europa y la primera mitad sólida de la sesión USA. Confirma la estructura del día.
                            </p>
                        </div>
                        <div>
                            <strong style={{ color: 'var(--accent-blue)' }}>🌙 22:45 CET — EOD Scan (Principal)</strong>
                            <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                                Cierre de USA. Es el escaneo definitivo: recalcula todos los scores y guarda el <strong>snapshot histórico diario</strong> que alimenta las gráficas.
                            </p>
                        </div>
                    </div>
                </section>

                <section style={{ marginBottom: 48 }}>
                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: 16 }}>
                        2. Fases Temporales
                    </h2>
                    <p style={{ marginBottom: 16 }}>
                        Los activos detectados fluyen automáticamente por 3 fases según los días consecutivos que mantengan su estructura técnica:
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '1.2rem' }}>🔥</span>
                            <div>
                                <strong style={{ color: 'var(--text-primary)' }}>Emerging (0–7 días)</strong>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>Acaban de aparecer en el radar. Alta volatilidad, alto riesgo de falsas rupturas. Fase de observación.</p>
                            </div>
                        </li>
                        <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '1.2rem' }}>🟢</span>
                            <div>
                                <strong style={{ color: 'var(--text-primary)' }}>Confirmed (7–30 días)</strong>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>La señal persiste. El ruido se elimina. Es la <strong>zona principal de inversión</strong>.</p>
                            </div>
                        </li>
                        <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ fontSize: '1.2rem' }}>🔵</span>
                            <div>
                                <strong style={{ color: 'var(--text-primary)' }}>Structural (+30 días)</strong>
                                <p style={{ margin: '2px 0 0', fontSize: '0.85rem' }}>Tendencia madura e institucionalizada. Se siguen para trailing stops o entradas en pullbacks fuertes.</p>
                            </div>
                        </li>
                    </ul>
                </section>

                <section style={{ marginBottom: 48 }}>
                    <h2 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: 16 }}>
                        3. Señales Técnicas Base
                    </h2>
                    <p style={{ marginBottom: 16 }}>
                        El score estructural de 0 a 100 se calcula combinando las siguientes métricas, diseñadas para detectar <strong>huella institucional</strong>:
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <span style={{ fontSize: '1.2rem' }}>📊</span>
                            <strong style={{ display: 'block', margin: '8px 0 4px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Explosión de Volumen</strong>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>Compara el volumen medio de las últimas 3 semanas vs los últimos 3 meses.</p>
                        </div>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <span style={{ fontSize: '1.2rem' }}>🔄</span>
                            <strong style={{ display: 'block', margin: '8px 0 4px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Compresión (Squeeze)</strong>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>Días consecutivos con ATR (Average True Range) en mínimos de 60 días pre-ruptura.</p>
                        </div>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <span style={{ fontSize: '1.2rem' }}>⬆️</span>
                            <strong style={{ display: 'block', margin: '8px 0 4px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Fuerza Relativa (RS)</strong>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>Outperformance claro frente a su ETF sectorial o el índice global (SPY).</p>
                        </div>
                        <div className="glass-card" style={{ padding: 16 }}>
                            <span style={{ fontSize: '1.2rem' }}>📈</span>
                            <strong style={{ display: 'block', margin: '8px 0 4px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>Estructura de Medias</strong>
                            <p style={{ margin: 0, fontSize: '0.8rem' }}>Persistencia del precio sobre medias clave (MA50 y MA200).</p>
                        </div>
                    </div>
                </section>

            </article>
        </div>
    );
}
