import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GeminiService } from './gemini.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('diaryCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private debounceTimer: any = null;
  private isGenerating = false;
  
  // Font settings for generation
  private readonly fontSize = 32;
  private readonly fontName = "'Reenie Beanie', cursive";
  
  constructor(private geminiService: GeminiService) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    
    const context = canvas.getContext('2d');
    if (context) {
      this.ctx = context;
    }

    // Set high DPI canvas for smooth drawing, this will also fill the background
    this.resizeCanvas();
  }

  ngOnDestroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.resizeCanvas();
  }

  private resizeCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    // Keep internal canvas resolution high but CSS sizes correct
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    
    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
      this.ctx.fillStyle = '#f4ecd8'; // Fill background to avoid transparency issues with the LLM vision
      this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
      this.setupCanvasContext();
    }
  }

  private setupCanvasContext(): void {
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = '#1a1a1a'; // Dark faded ink
    this.ctx.font = `${this.fontSize}px ${this.fontName}`;
    this.ctx.textBaseline = 'top';
  }

  startDrawing(event: PointerEvent): void {
    if (this.isGenerating) return;
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    
    this.isDrawing = true;
    const { offsetX, offsetY } = this.getCoordinates(event);
    this.ctx.beginPath();
    this.ctx.moveTo(offsetX, offsetY);
  }

  draw(event: PointerEvent): void {
    if (!this.isDrawing || this.isGenerating) return;
    
    event.preventDefault();
    const { offsetX, offsetY } = this.getCoordinates(event);
    this.ctx.lineTo(offsetX, offsetY);
    this.ctx.stroke();
  }

  stopDrawing(): void {
    if (!this.isDrawing) return;
    
    this.isDrawing = false;
    this.ctx.closePath();
    
    // Start idle trigger
    this.debounceTimer = setTimeout(() => {
      this.processInk();
    }, 1500); // 1.5 seconds after pointerup
  }

  private getCoordinates(event: PointerEvent): { offsetX: number, offsetY: number } {
    return {
      offsetX: event.clientX,
      offsetY: event.clientY
    };
  }

  private async processInk(): Promise<void> {
    this.isGenerating = true;
    
    // Extract canvas content
    const canvas = this.canvasRef.nativeElement;
    const base64Image = canvas.toDataURL('image/png');
    
    // Fade out ink over 1 second
    await this.fadeOutCanvas();
    
    // Start reading response
    try {
      await this.streamResponse(base64Image);
    } catch (error) {
      console.error('Error getting response:', error);
      alert(`Error from Gemini: ${error instanceof Error ? error.message : String(error)}`);
      this.renderTextLine("...the ink seems smudged, it cannot be read...", 50, 50);
    } finally {
      this.isGenerating = false;
    }
  }

  private fadeOutCanvas(): Promise<void> {
    return new Promise(resolve => {
      let opacity = 1.0;
      const fadeStep = () => {
        opacity -= 0.05;
        if (opacity <= 0) {
          // Reset canvas with parchment background
          this.ctx.fillStyle = '#f4ecd8';
          this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
          this.setupCanvasContext();
          resolve();
        } else {
          // Apply a semi-transparent white wash to simulate fading (or just use CSS fade if preferred)
          // Actually better to draw over with parchment color, but transparent is not possible without erasing.
          // Since it's a whiteish background, we can draw a highly transparent background-color rect.
          this.ctx.fillStyle = `rgba(244, 236, 216, 0.1)`; // #f4ecd8
          this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
          requestAnimationFrame(fadeStep);
        }
      };
      requestAnimationFrame(fadeStep);
    });
  }

  private async streamResponse(base64Image: string): Promise<void> {
    let currentX = 50;
    let currentY = 100;
    const maxWidth = window.innerWidth - 100;
    let currentLine = '';
    const lineHeight = this.fontSize * 1.5;

    const generator = this.geminiService.generateResponse(base64Image);
    
    for await (const chunk of generator) {
      const words = chunk.split('');
      for (const char of words) {
        if (char === '\n') {
          currentLine = '';
          currentY += lineHeight;
          currentX = 50;
          continue;
        }

        const metrics = this.ctx.measureText(currentLine + char);
        if (metrics.width > maxWidth) {
          if (char === ' ') continue; // Skip leading space on new line
          currentLine = '';
          currentY += lineHeight;
          currentX = 50;
        }
        
        const charX = currentX + this.ctx.measureText(currentLine).width;
        
        // Fire and forget the fade animation for this character
        this.drawFadingChar(char, charX, currentY);
        
        currentLine += char;
        
        // Add intentional delay to simulate typing rhythm
        await new Promise(resolve => setTimeout(resolve, 40));
      }
    }
  }

  private drawFadingChar(char: string, x: number, y: number): void {
    let step = 0;
    const maxSteps = 8;
    
    const fadeStep = () => {
      if (step < maxSteps) {
        this.ctx.fillStyle = 'rgba(26, 26, 26, 0.15)';
        this.ctx.fillText(char, x, y);
        step++;
        requestAnimationFrame(fadeStep);
      } else {
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillText(char, x, y);
      }
    };
    requestAnimationFrame(fadeStep);
  }

  private renderTextLine(text: string, x: number, y: number, isPreview: boolean = false): void {
    // Clear line area slightly if it's a preview to update
    if (isPreview) {
      this.ctx.fillStyle = '#f4ecd8';
      this.ctx.fillRect(x - 5, y - 5, this.ctx.measureText(text).width + 10, this.fontSize + 10);
    }
    
    // Simulate ink bleeding through with a slight fade
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillText(text, x, y);
  }
}
