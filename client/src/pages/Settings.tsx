import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Building, Shield } from "lucide-react";

export default function Settings() {
  const { data: user, isLoading: loadingUser } = trpc.auth.me.useQuery();
  const { data: workspace, isLoading: loadingWs } = trpc.workspace.get.useQuery();

  if (loadingUser || loadingWs) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-7 h-7 animate-spin text-green-600" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-gray-900">Configurações</h1>
        <p className="text-gray-500 text-sm mt-1">Informações da sua conta e workspace</p>
      </div>

      {/* Profile */}
      <Card className="mb-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-green-600" /> Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-xl font-display">
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{user?.name}</div>
              <div className="text-sm text-gray-500">{user?.email}</div>
              {user?.role === "admin" && (
                <Badge className="mt-1 bg-red-100 text-red-700 border-red-200 text-xs">
                  <Shield className="w-3 h-3 mr-1" /> Admin
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Nome</Label>
              <Input className="mt-1 bg-gray-50" value={user?.name ?? ""} disabled readOnly />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Email</Label>
              <Input className="mt-1 bg-gray-50" type="email" value={user?.email ?? ""} disabled readOnly />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Função</Label>
            <Input
              className="mt-1 bg-gray-50 capitalize"
              value={user?.role ?? "user"}
              disabled
              readOnly
            />
          </div>
          <p className="text-xs text-gray-400">
            Para alterar nome ou email, entre em contato com o suporte.
          </p>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building className="w-4 h-4 text-green-600" /> Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-gray-500">Nome do workspace</Label>
              <Input className="mt-1 bg-gray-50" value={workspace?.name ?? ""} disabled readOnly />
            </div>
            <div>
              <Label className="text-xs text-gray-500">Plano</Label>
              <Input
                className="mt-1 bg-gray-50 capitalize"
                value={workspace?.plan ?? ""}
                disabled
                readOnly
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-500">ID do workspace</Label>
            <Input className="mt-1 bg-gray-50" value={workspace?.id ?? ""} disabled readOnly />
          </div>
          <p className="text-xs text-gray-400">
            Para alterar o plano, acesse{" "}
            <a href="/billing" className="text-green-600 hover:underline">Plano & Cobrança</a>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
