import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Trash2, Save, X, Loader2, MapPin, MoreHorizontal, Send, CheckCircle2, FileUp, Upload, Clock } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useTeam } from "@/components/TeamProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FieldGroup from "@/components/FieldGroup";
import FieldRow from "@/components/FieldRow";
import SlackPushDialog from "@/components/SlackPushDialog";
import EmailBandDialog from "@/components/EmailBandDialog";
import ParseAdvanceForShowDialog from "@/components/ParseAdvanceForShowDialog";
import ExportPdfDialog from "@/components/ExportPdfDialog";
import GuestListEditor, { GuestListView, parseGuestList, guestTotal } from "@/components/GuestListEditor";
import ScheduleEditor, { type ScheduleRow } from "@/components/ScheduleEditor";
import EmptyFieldPrompt from "@/components/EmptyFieldPrompt";
import { toast } from "sonner";
import { cn, formatCityState } from "@/lib/utils";
import { normalizeTime } from "@/lib/timeFormat";
import type { Show } from "@/lib/types";
import RevenueSimulator, { parseDollar } from "@/components/RevenueSimulator";