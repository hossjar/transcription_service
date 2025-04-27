// src/app/hooks/useSSE.js
import { useEffect, useRef } from 'react';

export default function useSSE(onMessage) {
    const eventSourceRef = useRef(null);

    useEffect(() => {
        const API_URL = process.env.NEXT_PUBLIC_API_URL;

        function connect() {
            // Close existing connection if it exists
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
            }
            console.log('Connecting to SSE...');
            const eventSource = new EventSource(`${API_URL}/api/sse`, { withCredentials: true });
            eventSourceRef.current = eventSource;

            // Handle incoming messages
            eventSource.onmessage = (event) => {
                try {
                    if (event.data === ': keepalive') {
                        console.log('Received keep-alive');
                        return;
                    }
                    const data = JSON.parse(event.data);
                    console.log('SSE update:', data);
                    onMessage(data);
                } catch (error) {
                    console.error('Error parsing SSE message:', error);
                }
            };

            // Log connection opening
            eventSource.onopen = () => {
                console.log('SSE connection opened');
            };

            // Log errors but don’t close the connection
            eventSource.onerror = (error) => {
                console.error('SSE error:', error);
                // Let EventSource reconnect automatically
            };
        }

        connect();

        // Reconnect if page becomes visible or browser comes online
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && eventSourceRef.current.readyState === EventSource.CLOSED) {
                console.log('Page visible, reconnecting SSE');
                connect();
            }
        };

        const handleOnline = () => {
            if (eventSourceRef.current.readyState === EventSource.CLOSED) {
                console.log('Browser online, reconnecting SSE');
                connect();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);

        // Cleanup on unmount
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                console.log('SSE connection closed on cleanup');
            }
        };
    }, [onMessage]);

    return {
        reconnect: () => {
            console.log('Manual SSE reconnect');
            connect();
        },
    };
}