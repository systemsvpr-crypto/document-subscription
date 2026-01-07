// Machine types
export interface Machine {
  id: number;
  name: string;
  serialNumber: string;
  model: string;
  manufacturer: string;
  department: string;
  location: string;
  status: 'operational' | 'maintenance' | 'repair';
  purchaseDate: string;
  purchasePrice: number;
  vendor: string;
  warrantyExpiration: string;
  lastMaintenance: string;
  nextMaintenance: string;
  maintenanceSchedule: string[];
  totalRepairCost: number;
  repairCount: number;
  healthScore: number;
}

export interface MachineSpecification {
  name: string;
  value: string;
}

// Maintenance and Repair types
export interface MaintenanceTask {
  id: number;
  machineId: number;
  machineName: string;
  department: string;
  type: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'overdue';
  dueDate: string;
  completedDate?: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  location: 'On-site' | 'Off-site';
  vendor?: string;
  description: string;
  estimatedCost?: number;
}

export interface ChecklistItem {
  id: number;
  text: string;
  completed: boolean;
}

export interface RepairRecord {
  id: number;
  machineId: number;
  date: string;
  type: 'Repair' | 'Maintenance';
  issue: string;
  technician: string;
  cost: number;
  parts: string[];
  resolution: string;
}

export interface TaskHistory {
  id: number;
  date: string;
  user: string;
  action: string;
  notes?: string;
}

export interface TaskComment {
  id: number;
  user: string;
  timestamp: string;
  text: string;
}

export interface Document {
  id: number;
  name: string;
  type: string;
  size?: string;
  uploadedBy: string;
  date: string;
}

// Analytics and Reporting types
export interface CostData {
  name: string;
  cost: number;
}

export interface DepartmentCost {
  department: string;
  cost: number;
}

export interface ReliabilityScore {
  name: string;
  value: number;
  color: string;
}

export interface RepairVsPurchase {
  name: string;
  purchasePrice: number;
  repairCost: number;
  ratio: number;
}

export interface FailureData {
  name: string;
  failures: number;
}

export interface MaintenanceType {
  name: string;
  value: number;
  color: string;
}

export interface VendorPerformance {
  name: string;
  rating: number;
  responseTime: number;
  costEfficiency: number;
}



export interface TemperatureReading {

  time: string;

  temp: number;

}



export interface Indent {

  id: number;

  timestamp: string;

  indentNumber: string;

  machineName: string;

  machineSerialNo: string;

  doerName: string;

  department: string;

  machinePartName: string;

  problem: string;

  priority: string;

  expectedDeliveryDays: number;

  location: string;

  taskStatus: string;

  image?: string;

  remarks: string;

  soundOfMachine: string;

  temperature: string;

  maintenanceCost: number;

  vendorType?: 'Regular' | 'Three Party';

  vendorRemarks?: string;

}
