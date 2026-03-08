import { useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Matter from 'matter-js';
import { ArrowLeft, Share2 } from 'lucide-react';

export default function Invitation() {
  const [searchParams] = useSearchParams();
  const name = searchParams.get('name') || 'Guest';
  
  const sceneRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const renderRef = useRef<Matter.Render | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  
  // Refs for the DOM elements corresponding to physics bodies
  const boxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isSharing = useRef(false);

  // Items content (Texts + Color Boxes)
  const items = useMemo(() => {
    const textItems = [
      { type: 'text', content: `${name}님을` },
      { type: 'text', content: 'Node to Nod에' },
      { type: 'text', content: '초대합니다.' },
      { type: 'text', content: '을지로 108 : 페이지 메일' },
      { type: 'text', content: '26.03.17. - 21.' }
    ];
    
    const colors = ['#8FF1FC', '#FF1DB0', '#A2C6F8', '#9FF63B'];
    const colorItems = colors.map(color => ({ type: 'color', content: color }));
    
    // Combine and shuffle
    const combined = [...textItems, ...colorItems];
    return combined.sort(() => Math.random() - 0.5);
  }, [name]);

  useEffect(() => {
    if (!sceneRef.current) return;

    // Setup Matter.js
    const Engine = Matter.Engine,
          Render = Matter.Render,
          Runner = Matter.Runner,
          Bodies = Matter.Bodies,
          Composite = Matter.Composite,
          Events = Matter.Events,
          Mouse = Matter.Mouse,
          MouseConstraint = Matter.MouseConstraint;

    // Create engine
    const engine = Engine.create();
    engine.gravity.y = 0.6; // Adjusted gravity for medium speed
    engineRef.current = engine;

    // Create renderer (optional, for debugging or if we want to see the wireframes)
    // We keep it but make bodies transparent so we only see our DOM elements
    const render = Render.create({
      element: sceneRef.current,
      engine: engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: 'transparent',
        // pixelRatio: window.devicePixelRatio // Removed to fix coordinate mismatch on high DPI screens
      }
    });
    renderRef.current = render;

    const width = window.innerWidth;
    const height = window.innerHeight;

    // Create walls
    const wallThickness = 200;
    let ground = Bodies.rectangle(width / 2, height + wallThickness / 2, width, wallThickness, { isStatic: true });
    let leftWall = Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });
    let rightWall = Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height * 2, { isStatic: true });

    // Create bodies for text boxes based on measured DOM elements
    const boxBodies = items.map((_, index) => {
      const el = boxRefs.current[index];
      if (!el) return null;

      const rect = el.getBoundingClientRect();
      
      return Bodies.rectangle(
        width / 2 + (Math.random() - 0.5) * 100, // Random X start
        -100 - (index * 150), // Staggered Y start above screen
        rect.width,
        rect.height,
        {
          restitution: 0.5,
          friction: 0.1,
          frictionAir: 0.02, // Adjusted air resistance
          render: { opacity: 0 } // Invisible physics body
        }
      );
    }).filter(Boolean) as Matter.Body[];

    Composite.add(engine.world, [ground, leftWall, rightWall, ...boxBodies]);

    // Add mouse control
    const mouse = Mouse.create(render.canvas);
    mouse.pixelRatio = 1; // Force 1:1 mapping between screen pixels and physics coordinates
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.2,
        render: {
          visible: false
        }
      }
    });

    Composite.add(engine.world, mouseConstraint);

    // Keep the mouse in sync with rendering
    render.mouse = mouse;

    // Run the engine
    const runner = Runner.create();
    runnerRef.current = runner;
    Runner.run(runner, engine);
    Render.run(render);

    // Sync loop
    const updateLoop = () => {
      // Keep dragged body upright and horizontal
      if (mouseConstraint.body) {
        Matter.Body.setAngle(mouseConstraint.body, 0);
        Matter.Body.setAngularVelocity(mouseConstraint.body, 0);
      }

      boxBodies.forEach((body, index) => {
        const el = boxRefs.current[index];
        if (el) {
          const { x, y } = body.position;
          const angle = body.angle;
          // Update transform directly
          el.style.transform = `translate(${x - el.offsetWidth / 2}px, ${y - el.offsetHeight / 2}px) rotate(${angle}rad)`;
          el.style.opacity = '1'; // Make visible once positioned
        }
      });
      requestAnimationFrame(updateLoop);
    };
    
    const animationId = requestAnimationFrame(updateLoop);

    // Handle resize
    const handleResize = () => {
      if (!renderRef.current || !engineRef.current) return;
      
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      renderRef.current.canvas.width = newWidth;
      renderRef.current.canvas.height = newHeight;
      
      // Remove old walls
      Composite.remove(engine.world, [ground, leftWall, rightWall]);
      
      // Recreate walls with new dimensions
      const wallThickness = 200;
      ground = Bodies.rectangle(newWidth / 2, newHeight + wallThickness / 2, newWidth, wallThickness, { isStatic: true });
      leftWall = Bodies.rectangle(-wallThickness / 2, newHeight / 2, wallThickness, newHeight * 2, { isStatic: true });
      rightWall = Bodies.rectangle(newWidth + wallThickness / 2, newHeight / 2, wallThickness, newHeight * 2, { isStatic: true });
      
      // Add new walls
      Composite.add(engine.world, [ground, leftWall, rightWall]);
      
      // Bring stray bodies back into view if they went out of bounds
      boxBodies.forEach(body => {
        const { x, y } = body.position;
        let needsReset = false;
        let newX = x;
        let newY = y;

        if (x > newWidth + 50) {
          newX = newWidth - 50;
          needsReset = true;
        } else if (x < -50) {
          newX = 50;
          needsReset = true;
        }

        if (y > newHeight + 50) {
          newY = newHeight - 100;
          needsReset = true;
        }

        if (needsReset) {
          Matter.Body.setPosition(body, { x: newX, y: newY });
          Matter.Body.setVelocity(body, { x: 0, y: 0 });
        }
      });
    };

    window.addEventListener('resize', handleResize);

    // Handle device motion for gravity
    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      if (!engineRef.current) return;
      
      const { accelerationIncludingGravity } = event;
      if (!accelerationIncludingGravity) return;

      const rawX = accelerationIncludingGravity.x || 0;
      const rawY = accelerationIncludingGravity.y || 0;

      // Ignore if sensor data is essentially zero (e.g. desktop without sensors)
      if (Math.abs(rawX) < 0.1 && Math.abs(rawY) < 0.1) return;

      // Scale sensor data to Matter.js gravity
      // X: Left/Right tilt
      // Y: Up/Down tilt (Ensure it's always pulling down visually)
      const x = rawX * -0.1;
      const y = Math.abs(rawY * 0.1); // Force positive Y gravity so items always fall down

      // Apply to engine gravity with a minimum Y value to ensure falling
      engineRef.current.gravity.x = x;
      engineRef.current.gravity.y = Math.max(0.5, y); 
    };

    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      window.addEventListener('devicemotion', handleDeviceMotion);
    }

    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      Render.stop(render);
      Runner.stop(runner);
      if (render.canvas) render.canvas.remove();
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    };
  }, [name]); // Re-run if name changes

  // Request permission for iOS 13+ devices
  const requestMotionPermission = async () => {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          // Permission granted, listener will be added by useEffect or we can reload
          // Actually, we need to re-add listener here if it wasn't allowed before
          // But usually useEffect adds it, and the browser blocks it until permission.
          // Let's just alert for feedback or rely on the listener starting to work.
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleShare = async () => {
    if (isSharing.current) return;

    if (navigator.share) {
      try {
        isSharing.current = true;
        await navigator.share({
          title: 'Node to Nod 초대장',
          text: `${name}님을 Node to Nod에 초대합니다.`,
          url: window.location.href,
        });
      } catch (err: any) {
        // Ignore user cancellation or concurrent share errors
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
           console.error('Error sharing:', err);
        }
      } finally {
        isSharing.current = false;
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        alert('링크가 복사되었습니다!');
      } catch (err) {
        console.error('Clipboard error:', err);
      }
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-neutral-100 font-sans">
      {/* Background Image Layer */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
        style={{ 
          backgroundImage: "url('/assets/invitation-background.png')",
        }}
      />
      
      {/* Physics Canvas Container (Invisible but needed for Matter.js to attach) */}
      <div 
        ref={sceneRef} 
        className="absolute inset-0 z-20 touch-none" 
        onClick={requestMotionPermission}
      />

      {/* DOM Elements for Text Boxes */}
      {items.map((item, index) => (
        <div
          key={index}
          ref={el => boxRefs.current[index] = el}
          className={`absolute left-0 top-0 shadow-lg z-10 flex items-center justify-center select-none ${
            item.type === 'text' 
              ? 'bg-black border border-white/20 px-8 py-6 md:px-10 md:py-8' 
              : 'w-24 h-24 md:w-32 md:h-32'
          }`}
          style={{
            backgroundColor: item.type === 'color' ? item.content : undefined,
            opacity: 0, // Hidden initially until physics takes over
            willChange: 'transform',
            whiteSpace: 'nowrap',
            maxWidth: '90vw' // Allow wider boxes
          }}
        >
          {item.type === 'text' && (
            <span className="text-2xl md:text-4xl font-bold text-white overflow-hidden text-ellipsis">
              {item.content}
            </span>
          )}
        </div>
      ))}

      {/* UI Controls */}
      <div className="absolute top-4 left-4 z-30">
        <Link 
          to="/" 
          className="p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-neutral-800" />
        </Link>
      </div>

      <div className="absolute top-4 right-4 z-30">
        <button 
          onClick={handleShare}
          className="p-3 bg-white/80 backdrop-blur-sm rounded-full shadow-sm hover:bg-white transition-colors flex items-center justify-center"
        >
          <Share2 className="w-5 h-5 text-neutral-800" />
        </button>
      </div>
      
      {/* Footer */}
      <div className="absolute bottom-8 left-0 right-0 text-center z-0 pointer-events-none opacity-30">
        <p className="text-xs uppercase tracking-widest">Node to Nod Invitation</p>
      </div>
    </div>
  );
}
