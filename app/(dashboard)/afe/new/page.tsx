"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, FileText, X, GripVertical } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { SignatureBoxPlacer } from "@/components/afe/signature-box-placer";

const formSchema = z.object({
  afeName: z.string().min(1, "AFE name is required").max(255),
  afeNumber: z.string().max(100).optional(),
});

type FormData = z.infer<typeof formSchema>;

interface User {
  id: string;
  name: string;
  email: string;
  title?: string | null;
}

interface PlacedBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
}

interface SelectedSigner extends User {
  order: number;
  signatureBox?: PlacedBox;
  titleBox?: PlacedBox;
  dateBox?: PlacedBox;
}

export default function NewAfePage() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [signers, setSigners] = useState<SelectedSigner[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  // Fetch available signers
  const fetchUsers = async () => {
    if (users.length > 0) return;
    setLoadingUsers(true);
    try {
      const res = await fetch("/api/users?signersOnly=true");
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
    } else {
      toast.error("Invalid file", "Please select a PDF file");
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const addSigner = (user: User) => {
    if (signers.find((s) => s.id === user.id)) return;
    setSigners((prev) => [
      ...prev,
      { ...user, order: prev.length + 1 },
    ]);
  };

  const removeSigner = (userId: string) => {
    setSigners((prev) => {
      const filtered = prev.filter((s) => s.id !== userId);
      // Reorder
      return filtered.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  const moveSigner = (index: number, direction: "up" | "down") => {
    const newSigners = [...signers];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= signers.length) return;

    [newSigners[index], newSigners[newIndex]] = [newSigners[newIndex], newSigners[index]];
    setSigners(newSigners.map((s, i) => ({ ...s, order: i + 1 })));
  };

  const handleNextStep = async () => {
    if (step === 1) {
      const isValid = getValues("afeName");
      if (!isValid || !file) {
        toast.error("Missing information", "Please enter AFE name and upload a PDF");
        return;
      }
      await fetchUsers();
      setStep(2);
    } else if (step === 2) {
      if (signers.length === 0) {
        toast.error("No signers", "Please add at least one signer");
        return;
      }
      setStep(3);
    } else if (step === 3) {
      // Signature boxes placed, go to review
      setStep(4);
    }
  };

  const handleCreate = async () => {
    setUploading(true);
    try {
      // 1. Upload PDF
      const formData = new FormData();
      formData.append("file", file!);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        toast.error("Upload failed", uploadData.error || "Failed to upload PDF");
        return;
      }

      // 2. Create AFE
      const values = getValues();
      const createRes = await fetch("/api/afe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          afeName: values.afeName,
          afeNumber: values.afeNumber,
          originalPdfUrl: uploadData.data.url,
        }),
      });
      const createData = await createRes.json();

      if (!createData.success) {
        toast.error("Creation failed", createData.error || "Failed to create AFE");
        return;
      }

      const afeId = createData.data.id;

      // 3. Assign signers with signature, title, and date box positions
      const signersRes = await fetch(`/api/afe/${afeId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signers: signers.map((s) => ({
            userId: s.id,
            signingOrder: s.order,
            signatureX: s.signatureBox?.pdfX,
            signatureY: s.signatureBox?.pdfY,
            signatureWidth: s.signatureBox?.pdfWidth,
            signatureHeight: s.signatureBox?.pdfHeight,
            titleX: s.titleBox?.pdfX,
            titleY: s.titleBox?.pdfY,
            titleWidth: s.titleBox?.pdfWidth,
            titleHeight: s.titleBox?.pdfHeight,
            dateX: s.dateBox?.pdfX,
            dateY: s.dateBox?.pdfY,
            dateWidth: s.dateBox?.pdfWidth,
            dateHeight: s.dateBox?.pdfHeight,
          })),
        }),
      });
      const signersData = await signersRes.json();

      if (!signersData.success) {
        toast.error("Signer assignment failed", signersData.error || "Failed to assign signers");
        return;
      }

      // Success - redirect to AFE
      toast.success("AFE created", "The AFE has been created and signers have been notified.");
      router.push(`/afe/${afeId}`);
    } catch (error) {
      console.error("Error creating AFE:", error);
      toast.error("Creation failed", "An unexpected error occurred");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/afe">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New AFE</h1>
          <p className="text-muted-foreground">
            Upload a PDF and assign signers
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s}
            </div>
            {s < 4 && (
              <div
                className={`w-12 h-1 ${
                  step > s ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Details & Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>AFE Details</CardTitle>
            <CardDescription>
              Enter the AFE information and upload the PDF document
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="afeName">AFE Name *</Label>
              <Input
                id="afeName"
                {...register("afeName")}
                placeholder="Enter AFE name"
              />
              {errors.afeName && (
                <p className="text-sm text-destructive">
                  {errors.afeName.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="afeNumber">AFE Number (optional)</Label>
              <Input
                id="afeNumber"
                {...register("afeNumber")}
                placeholder="e.g., AFE-2024-001"
              />
            </div>

            <div className="space-y-2">
              <Label>PDF Document *</Label>
              {file ? (
                <div className="flex items-center gap-3 p-3 border rounded-md">
                  <FileText className="h-8 w-8 text-red-500" />
                  <div className="flex-1">
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={removeFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-2">
                    Drag and drop or click to upload
                  </p>
                  <Input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="pdf-upload"
                  />
                  <Label htmlFor="pdf-upload">
                    <Button variant="outline" asChild>
                      <span>Select PDF</span>
                    </Button>
                  </Label>
                </div>
              )}
            </div>

            <Button onClick={handleNextStep} className="w-full" disabled={!file}>
              Next: Add Signers
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Signers */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Assign Signers</CardTitle>
            <CardDescription>
              Select users and arrange them in the signing order
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Selected Signers */}
            <div className="space-y-2">
              <Label>Signing Order</Label>
              {signers.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 border rounded-md">
                  No signers added yet
                </p>
              ) : (
                <div className="space-y-2">
                  {signers.map((signer, index) => (
                    <div
                      key={signer.id}
                      className="flex items-center gap-3 p-3 border rounded-md"
                    >
                      <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                        {signer.order}
                      </span>
                      <div className="flex-1">
                        <p className="font-medium">{signer.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {signer.email}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveSigner(index, "up")}
                          disabled={index === 0}
                        >
                          <span className="text-xs">Up</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => moveSigner(index, "down")}
                          disabled={index === signers.length - 1}
                        >
                          <span className="text-xs">Down</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSigner(signer.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Available Users */}
            <div className="space-y-2">
              <Label>Available Signers</Label>
              {loadingUsers ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                  {users
                    .filter((u) => !signers.find((s) => s.id === u.id))
                    .map((user) => (
                      <button
                        key={user.id}
                        onClick={() => addSigner(user)}
                        className="w-full text-left p-2 rounded hover:bg-muted"
                      >
                        <p className="font-medium">{user.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button
                onClick={handleNextStep}
                className="flex-1"
                disabled={signers.length === 0}
              >
                Next: Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Signature Placement */}
      {step === 3 && file && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Place Signature Boxes</h2>
          <SignatureBoxPlacer
            pdfFile={file}
            signers={signers}
            onSignersUpdate={setSigners}
            onComplete={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        </div>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Create</CardTitle>
            <CardDescription>
              Review the details before creating the AFE
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 p-4 bg-muted rounded-md">
              <div>
                <span className="text-sm text-muted-foreground">AFE Name:</span>
                <p className="font-medium">{getValues("afeName")}</p>
              </div>
              {getValues("afeNumber") && (
                <div>
                  <span className="text-sm text-muted-foreground">
                    AFE Number:
                  </span>
                  <p className="font-medium">{getValues("afeNumber")}</p>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Document:</span>
                <p className="font-medium">{file?.name}</p>
              </div>
            </div>

            <div>
              <Label>Signing Order ({signers.length} signers)</Label>
              <div className="space-y-2 mt-2">
                {signers.map((signer) => (
                  <div
                    key={signer.id}
                    className="flex items-center gap-3 p-2 border rounded"
                  >
                    <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                      {signer.order}
                    </span>
                    <span>{signer.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(3)}>
                Back
              </Button>
              <Button
                onClick={handleCreate}
                className="flex-1"
                disabled={uploading}
              >
                {uploading ? "Creating..." : "Create AFE"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
