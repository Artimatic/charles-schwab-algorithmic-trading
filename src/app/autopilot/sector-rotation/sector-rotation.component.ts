import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from "@angular/core";
import {
  SectorRotationService,
  SectorRotationResult,
} from "./sector-rotation.service";
import * as moment from "moment";

@Component({
  selector: "app-sector-rotation",
  templateUrl: "./sector-rotation.component.html",
  styleUrls: ["./sector-rotation.component.css"],
})
export class SectorRotationComponent implements OnInit, AfterViewInit {
  @ViewChild("rrgCanvas", { static: false })
  rrgCanvas!: ElementRef<HTMLCanvasElement>;

  public rotationData: SectorRotationResult[] = [];
  public filteredData: SectorRotationResult[] = [];
  public isLoading: boolean = false;
  public errorMessage: string = "";

  // Controls
  public selectedDate: string = moment().format("YYYY-MM-DD");
  public lookbackDays: number = 360;
  public selectedCategory: string = "ALL";

  constructor(private rotationService: SectorRotationService) {}

  ngOnInit(): void {
    this.loadSectorData();
  }

  ngAfterViewInit(): void {
    // Redraw matrix whenever data changes
  }

  public loadSectorData(): void {
    this.isLoading = true;
    this.errorMessage = "";

    this.rotationService
      .getSectorRotation(this.selectedDate, this.lookbackDays)
      .subscribe({
        next: (data) => {
          this.rotationData = data;
          this.filterData();
          this.isLoading = false;
        },
        error: (err) => {
          console.error(err);
          this.errorMessage = "Failed to load sector rotation metrics.";
          this.isLoading = false;
        },
      });
  }

  public filterData(): void {
    if (this.selectedCategory === "ALL") {
      this.filteredData = this.rotationData;
    } else {
      this.filteredData = this.rotationData.filter(
        (item) => item.category === this.selectedCategory,
      );
    }
    // Set timeout to ensure DOM update binds canvas reference safely
    setTimeout(() => this.drawRrgGraph(), 50);
  }

  private drawRrgGraph(): void {
    if (!this.rrgCanvas) return;
    const canvas = this.rrgCanvas.nativeElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear Canvas
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Quadrant Background Colors
    // Top-Right: Leading (Light Green)
    ctx.fillStyle = "rgba(230, 245, 230, 0.6)";
    ctx.fillRect(centerX, 0, centerX, centerY);
    // Bottom-Right: Weakening (Light Yellow)
    ctx.fillStyle = "rgba(255, 253, 220, 0.6)";
    ctx.fillRect(centerX, centerY, centerX, centerY);
    // Bottom-Left: Lagging (Light Red)
    ctx.fillStyle = "rgba(255, 230, 230, 0.6)";
    ctx.fillRect(0, centerY, centerX, centerY);
    // Top-Left: Improving (Light Blue)
    ctx.fillStyle = "rgba(230, 240, 255, 0.6)";
    ctx.fillRect(0, 0, centerX, centerY);

    // 2. Draw Crosshair Grid Axes (The 100 centerlines)
    ctx.strokeStyle = "#888888";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    // Horizontal Line (RS-Momentum = 100)
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
    // Vertical Line (RS-Ratio = 100)
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.stroke();
    ctx.setLineDash([]); // Reset Line dash

    // 3. Draw Quadrant Labels
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#2e7d32";
    ctx.fillText("LEADING (+/+)", width - 130, 30);
    ctx.fillStyle = "#f57f17";
    ctx.fillText("WEAKENING (+/-)", width - 140, height - 20);
    ctx.fillStyle = "#c62828";
    ctx.fillText("LAGGING (-/-)", 20, height - 20);
    ctx.fillStyle = "#1565c0";
    ctx.fillText("IMPROVING (-/+)", 20, 30);

    // 4. Plot Sector Coordinates
    // Dynamic scale bounds based on deviations from 100 axis center
    const padding = 60;
    const maxDev = Math.max(
      ...this.filteredData.map((d) =>
        Math.max(Math.abs(d.rsRatio - 100), Math.abs(d.rsMomentum - 100)),
      ),
      1.5,
    );
    const scale = (centerX - padding) / maxDev;

    this.filteredData.forEach((sector) => {
      // Convert mathematical values into Canvas pixel coordinates
      const x = centerX + (sector.rsRatio - 100) * scale;
      const y = centerY - (sector.rsMomentum - 100) * scale; // Invert Y because canvas 0 is top

      // Draw dot point
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = "#2c3e50";
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label Sector ticker
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#111111";
      ctx.fillText(sector.ticker, x + 10, y + 4);
    });
  }
}
